v1Router.get("/sku-details/:id", authenticateJWT, async (req, res) => {
  console.log("req.params.id", req.params.id);
  try {
    const sku = await Sku.findByPk(req.params.id, {
      include: [
        {
          model: db.User,
          as: "sku_creator",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: db.User,
          as: "sku_updater",
          attributes: ["id", "name"],
          required: false,
        },
      ],
    });

    if (!sku) {
      return res.status(404).json({ message: "SKU not found" });
    }

    // Parse sku_values if it's stored as a JSON string
    const formattedSku = {
      ...sku.toJSON(),
      sku_values: sku.sku_values ? JSON.parse(sku.sku_values) : null,
    };

    res.status(200).json(formattedSku);
  } catch (error) {
    logger.error("Error fetching SKU by ID:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

v1Router.get(
  "/sku-details/download/excel",
  authenticateJWT,
  async (req, res) => {
    try {
      const {
        search = "",
        status = "active",
        sku_type,
        client,
        includeInactive = false,
      } = req.query;

      // Build the where condition
      const whereCondition = {};

      // Status handling
      if (includeInactive !== "true") {
        whereCondition.status = status;
      }

      // Additional filters
      if (sku_type) whereCondition.sku_type = sku_type;
      if (client) whereCondition.client = client;

      // Search across multiple fields
      if (search) {
        whereCondition[Op.or] = [
          { sku_name: { [Op.like]: `%${search}%` } },
          { client: { [Op.like]: `%${search}%` } },
          { sku_type: { [Op.like]: `%${search}%` } },
          { reference_number: { [Op.like]: `%${search}%` } },
        ];
      }

      // Fetch SKUs with related data
      const { rows: skus } = await Sku.findAndCountAll({
        where: whereCondition,
        include: [
          {
            model: db.User,
            as: "sku_creator",
            attributes: ["id", "name", "email"],
          },
          {
            model: db.User,
            as: "sku_updater",
            attributes: ["id", "name", "email"],
          },
          {
            model: db.Client,
            attributes: [],
          },
        ],
        order: [["id", "ASC"]],
      });

      // Create a new Excel workbook
      const workbook = new ExcelJS.Workbook();
      const skuSheet = workbook.addWorksheet("SKU Details");

      // Define columns with comprehensive SKU details
      skuSheet.columns = [
        { header: "SKU ID", key: "id", width: 10 },
        { header: "SKU Name", key: "sku_name", width: 20 },
        { header: "Client", key: "client", width: 20 },
        { header: "SKU Type", key: "sku_type", width: 15 },
        { header: "Ply", key: "ply", width: 10 },
        { header: "Length (cm)", key: "length", width: 12 },
        { header: "Width (cm)", key: "width", width: 12 },
        { header: "Height (cm)", key: "height", width: 12 },
        { header: "Unit", key: "unit", width: 10 },
        { header: "Joints", key: "joints", width: 10 },
        { header: "UPS", key: "ups", width: 10 },
        { header: "select_dies", key: "select_dies", width: 10 },
        { header: "Inner/Outer", key: "inner_outer_dimension", width: 15 },
        { header: "Flap Width", key: "flap_width", width: 12 },
        { header: "Flap Tolerance", key: "flap_tolerance", width: 15 },
        {
          header: "Length Trimming Tolerance",
          key: "length_trimming_tolerance",
          width: 20,
        },
        { header: "Strict Adherence", key: "strict_adherence", width: 15 },
        { header: "Customer Reference", key: "customer_reference", width: 20 },
        { header: "Reference Number", key: "reference_number", width: 20 },
        { header: "Internal ID", key: "internal_id", width: 15 },
        { header: "Board Size (cm²)", key: "board_size_cm2", width: 15 },
        { header: "Deckle Size", key: "deckle_size", width: 15 },
        {
          header: "Minimum Order Level",
          key: "minimum_order_level",
          width: 20,
        },
        { header: "Status", key: "status", width: 12 },
        { header: "Created By", key: "created_by_name", width: 20 },
        { header: "Created At", key: "created_at", width: 20 },
        { header: "Updated By", key: "updated_by_name", width: 20 },
        { header: "Updated At", key: "updated_at", width: 20 },
      ];

      // Header styling
      const headerStyle = {
        font: { bold: true, color: { argb: "FFFFFF" } },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "4472C4" },
        },
        alignment: { horizontal: "center", vertical: "middle" },
      };

      // Apply header style
      skuSheet.getRow(1).eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Add data to sheet
      skus.forEach((sku) => {
        skuSheet.addRow({
          id: sku.id,
          sku_name: sku.sku_name,
          client: sku.client,
          sku_type: sku.sku_type,
          ply: sku.ply,
          length: sku.length,
          width: sku.width,
          height: sku.height,
          unit: sku.unit,
          joints: sku.joints,
          ups: sku.ups,
          select_dies: sku.select_dies,
          inner_outer_dimension: sku.inner_outer_dimension,
          flap_width: sku.flap_width,
          flap_tolerance: sku.flap_tolerance,
          length_trimming_tolerance: sku.length_trimming_tolerance,
          strict_adherence: sku.strict_adherence ? "Yes" : "No",
          customer_reference: sku.customer_reference,
          reference_number: sku.reference_number,
          internal_id: sku.internal_id,
          board_size_cm2: sku.board_size_cm2,
          deckle_size: sku.deckle_size,
          minimum_order_level: sku.minimum_order_level,
          status: sku.status,
          created_by_name: sku.sku_creator ? sku.sku_creator.name : "N/A",
          created_at: sku.created_at
            ? new Date(sku.created_at).toLocaleString()
            : "N/A",
          updated_by_name: sku.sku_updater ? sku.sku_updater.name : "N/A",
          updated_at: sku.updated_at
            ? new Date(sku.updated_at).toLocaleString()
            : "N/A",
        });
      });

      // Apply alternating row colors
      skuSheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          const fillColor = rowNumber % 2 === 0 ? "F2F2F2" : "FFFFFF";
          row.eachCell((cell) => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: fillColor },
            };
          });
        }
      });

      // Create a readable stream for the workbook
      const buffer = await workbook.xlsx.writeBuffer();
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);

      // Set response headers for file download
      const searchSuffix = search ? `-${search}` : "";
      const skuTypeSuffix = sku_type ? `-${sku_type}` : "";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `sku-details${searchSuffix}${skuTypeSuffix}-${timestamp}.xlsx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

      // Pipe the stream to response
      stream.pipe(res);

      // Log the download
      logger.info(
        `SKU Excel download initiated by user ${
          req.user.id
        } with filters: ${JSON.stringify({
          search,
          status,
          sku_type,
          client,
        })}`
      );
    } catch (error) {
      logger.error("SKU Excel Download Error:", error);
      return res.status(500).json({ status: false, message: error.message });
    }
  }
);

v1Router.get("/sku-details/sku-type/get", authenticateJWT, async (req, res) => {
  try {
    const { status = "active", company_id } = req.query;

    // Prepare where conditions
    const whereConditions = {
      status: status,
    };

    // Add company_id filter if provided
    if (company_id) {
      whereConditions.company_id = company_id;
    }

    // Find SKU types with associated data
    const skuTypes = await SkuType.findAll({
      where: whereConditions,
      include: [
        {
          model: db.User,
          as: "creator_sku_types",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: db.User,
          as: "updater_sku_types",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: db.Company,
          attributes: ["id"],
          required: false,
        },
      ],
      order: [["created_at", "DESC"]], // Order by creation date
    });

    // If no SKU types found, return meaningful response
    if (skuTypes.length === 0) {
      return res.status(404).json({
        message: "No SKU types found",
        data: [],
      });
    }

    // Send response with SKU types
    res.status(200).json({
      data: skuTypes,
    });
  } catch (error) {
    console.error("Error in SKU Type Fetch:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});
// 🔹 Create SKU Type
v1Router.post("/sku-details/sku-type", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const skuTypeData = {
      ...req.body,
      company_id: req.user.company_id,
      created_by: req.user.id,
      updated_by: req.user.id,
      status: "active",
    };

    const newSkuType = await SkuType.create(skuTypeData, { transaction: t });
    await t.commit();
    res
      .status(201)
      .json({ message: "SKU Type created successfully", skuType: newSkuType });
  } catch (error) {
    await t.rollback();
    res
      .status(500)
      .json({ message: "Error creating SKU Type", error: error.message });
  }
});

// 🔹 Update SKU Type
v1Router.put("/sku-details/sku-type/:id", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { sku_type } = req.body; // Extract only sku_type

    if (!sku_type) {
      return res.status(400).json({ message: "sku_type is required" });
    }

    const updatedSkuType = await SkuType.update(
      {
        sku_type,
        updated_at: new Date(),
        updated_by: req.user.id,
      },
      {
        where: { id: req.params.id },
        transaction: t,
      }
    );

    if (!updatedSkuType[0]) {
      await t.rollback();
      return res
        .status(404)
        .json({ message: "SKU Type not found or no changes made" });
    }

    // Fetch the updated record after update
    const updatedRecord = await SkuType.findOne({
      where: { id: req.params.id },
      transaction: t,
    });

    await t.commit();
    res.status(200).json({
      message: "SKU Type updated successfully",
      updated_sku_type: updatedRecord,
    });
  } catch (error) {
    await t.rollback();
    res
      .status(500)
      .json({ message: "Error updating SKU Type", error: error.message });
  }
});

// 🔹 Soft Delete SKU Type
v1Router.delete(
  "/sku-details/sku-type/:id",
  authenticateJWT,
  async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const updatedSkuType = await SkuType.update(
        {
          status: "inactive",
          updated_by: req.user.id,
        },
        {
          where: { id: req.params.id },
          transaction: t,
        }
      );

      if (!updatedSkuType[0])
        return res.status(404).json({ message: "SKU Type not found" });

      await t.commit();
      res
        .status(200)
        .json({ message: "SKU Type marked as inactive successfully" });
    } catch (error) {
      await t.rollback();
      res
        .status(500)
        .json({ message: "Error deactivating SKU Type", error: error.message });
    }
  }
);