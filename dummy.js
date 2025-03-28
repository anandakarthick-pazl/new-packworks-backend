v1Router.get("/sku-details/download/excel", authenticateJWT, async (req, res) => {
  try {
    const {
      format = "csv",
      search = "",
      sku_name,
      client,
      ply,
      sku_type,
      status = "active",
    } = req.query;

    // Build the where condition similar to the GET /sku-details route
    let whereCondition = {
      status: status,
    };

    // Handle specific field searches if provided
    if (sku_name) whereCondition.sku_name = { [Op.like]: `%${sku_name}%` };
    if (ply) whereCondition.ply = { [Op.like]: `%${ply}%` };
    if (client) whereCondition.client = { [Op.like]: `%${client}%` };
    if (sku_type) whereCondition.sku_type = { [Op.like]: `%${sku_type}%` };

    // Handle generic search across multiple fields
    if (search) {
      whereCondition = {
        [Op.and]: [
          { status: status },
          {
            [Op.or]: [
              { sku_name: { [Op.like]: `%${search}%` } },
              { client: { [Op.like]: `%${search}%` } },
              { ply: { [Op.like]: `%${ply}%` } },
              { sku_type: { [Op.like]: `%${search}%` } },
            ],
          },
        ],
      };
    }

    // Fetch skus with all fields
    const skus = await Sku.findAll({
      where: whereCondition,
      include: [
        {
          model: db.User,
          as: "sku_creator",
          attributes: ["name"],
          required: false,
        },
        {
          model: db.User,
          as: "sku_updater",
          attributes: ["name"],
          required: false,
        },
      ],
    });

    // Transform SKUs for download
    const skuData = skus.map((sku) => {
      const skuJson = sku.toJSON();
      return {
        ID: skuJson.id,
        SKU_Name: skuJson.sku_name,
        Client: skuJson.client,
        Ply: skuJson.ply,
        Length: skuJson.length,
        Width: skuJson.width,
        Height: skuJson.height,
        Unit: skuJson.unit,
        Joints: skuJson.joints,
        UPS: skuJson.ups,
        Inner_Outer_Dimension: skuJson.inner_outer_dimension,
        Flap_Width: skuJson.flap_width,
        Flap_Tolerance: skuJson.flap_tolerance,
        Length_Trimming_Tolerance: skuJson.length_trimming_tolerance,
        Strict_Adherence: skuJson.strict_adherence ? "Yes" : "No",
        Customer_Reference: skuJson.customer_reference,
        Reference_Number: skuJson.reference_number,
        Internal_ID: skuJson.internal_id,
        Board_Size_CM2: skuJson.board_size_cm2,
        Deckle_Size: skuJson.deckle_size,
        Minimum_Order_Level: skuJson.minimum_order_level,
        SKU_Type: skuJson.sku_type,
        Status: skuJson.status,
        Created_By: skuJson.sku_creator?.name || "N/A",
        Updated_By: skuJson.sku_updater?.name || "N/A",
        Created_At: skuJson.created_at
          ? new Date(skuJson.created_at).toLocaleString()
          : "N/A",
        Updated_At: skuJson.updated_at
          ? new Date(skuJson.updated_at).toLocaleString()
          : "N/A",
      };
    });

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `SKU_Export_${timestamp}`;

    // Format conversion
    switch (format.toLowerCase()) {
      case "csv":
        const csvWorksheet = xlsx.utils.json_to_sheet(skuData);
        const csvWorkbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(csvWorkbook, csvWorksheet, "SKUs");

        // Set headers for CSV download
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=${filename}.csv`
        );

        // Convert to CSV buffer
        const csvBuffer = xlsx.write(csvWorkbook, {
          type: "buffer",
          bookType: "csv",
        });
        return res.send(csvBuffer);

      case "xlsx":
        const worksheet = xlsx.utils.json_to_sheet(skuData);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "SKUs");

        // Set headers for XLSX download
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=${filename}.xlsx`
        );

        // Convert to XLSX buffer
        const xlsxBuffer = xlsx.write(workbook, {
          type: "buffer",
          bookType: "xlsx",
        });
        return res.send(xlsxBuffer);

      default:
        return res.status(400).json({
          message: "Invalid download format. Supported formats: csv, xlsx",
        });
    }
  } catch (error) {
    logger.error("Error downloading SKUs:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});


