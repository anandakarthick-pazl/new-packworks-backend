// Create a new invoice history record
v1Router.post("/invoice-history", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Add created_by and updated_by from the authenticated user
    const invoiceData = {
      ...req.body,
      company_id: req.user.company_id,
      created_by: req.user.id,
      updated_by: req.user.id,
      status: "active",
    };

    // Validate required fields
    const requiredFields = ['client_id', 'sku_id', 'invoice_number', 'date', 'quantity', 'rate_per_sku', 'cost'];
    for (const field of requiredFields) {
      if (!invoiceData[field]) {
        await t.rollback();
        return res.status(400).json({ message: `${field} is required` });
      }
    }

    // Check if invoice number already exists
    const existingInvoice = await SkuInvoiceHistory.findOne({
      where: { invoice_number: invoiceData.invoice_number },
      transaction: t
    });

    if (existingInvoice) {
      await t.rollback();
      return res.status(400).json({ message: "Invoice number already exists" });
    }

    // Check if SKU exists
    const sku = await Sku.findByPk(invoiceData.sku_id, { transaction: t });
    if (!sku) {
      await t.rollback();
      return res.status(404).json({ message: "SKU not found" });
    }

    // Check if Client exists
    const client = await Client.findByPk(invoiceData.client_id, { transaction: t });
    if (!client) {
      await t.rollback();
      return res.status(404).json({ message: "Client not found" });
    }

    // Create new invoice record
    const newInvoice = await SkuInvoiceHistory.create(invoiceData, { transaction: t });
    await t.commit();

    // Publish to queue
    await publishToQueue({
      operation: "CREATE_INVOICE",
      invoiceId: newInvoice.id,
      timestamp: new Date(),
      data: newInvoice,
    });

    res.status(201).json({ message: "Invoice created successfully", invoice: newInvoice });
  } catch (error) {
    await t.rollback();
    logger.error("Error creating invoice:", error);
    res.status(500).json({ message: "Error creating invoice", error: error.message });
  }
});

// Get all invoice history records with filtering and pagination
v1Router.get("/invoice-history", authenticateJWT, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      invoice_number,
      client_id,
      sku_id,
      date_from,
      date_to,
      status = "active",
    } = req.query;

    const offset = (page - 1) * limit;

    // Build the where condition for search
    let whereCondition = {
      status: status,
      company_id: req.user.company_id
    };

    // Handle specific field searches if provided
    if (invoice_number) whereCondition.invoice_number = { [Op.like]: `%${invoice_number}%` };
    if (client_id) whereCondition.client_id = client_id;
    if (sku_id) whereCondition.sku_id = sku_id;
    
    // Handle date range if provided
    if (date_from && date_to) {
      whereCondition.date = {
        [Op.between]: [date_from, date_to]
      };
    } else if (date_from) {
      whereCondition.date = {
        [Op.gte]: date_from
      };
    } else if (date_to) {
      whereCondition.date = {
        [Op.lte]: date_to
      };
    }

    // Handle generic search across multiple fields
    if (search) {
      whereCondition = {
        [Op.and]: [
          { status: status, company_id: req.user.company_id },
          {
            [Op.or]: [
              { invoice_number: { [Op.like]: `%${search}%` } }
            ],
          },
        ],
      };
    }

    // Get total count for pagination metadata
    const totalCount = await SkuInvoiceHistory.count({ where: whereCondition });

    // Fetch invoices with pagination and search
    const invoices = await SkuInvoiceHistory.findAll({
      where: whereCondition,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: Sku,
          attributes: ['id', 'sku_name'],
          required: false,
        },
        {
          model: Client,
          attributes: ['client_id', 'client_name'],
          required: false,
        },
        {
          model: User,
          as: "creator_SkuInvoiceHistory",
          attributes: ['id', 'name'],
          required: false,
        },
        {
          model: User,
          as: "updater_invoice",
          attributes: ['id', 'name'],
          required: false,
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Calculate total stats for dashboard
    const totalInvoiceAmount = await SkuInvoiceHistory.sum('cost', {
      where: { 
        status: 'active',
        company_id: req.user.company_id
      }
    }) || 0;

    const totalItemsCount = await SkuInvoiceHistory.sum('quantity', {
      where: { 
        status: 'active',
        company_id: req.user.company_id
      }
    }) || 0;

    const totalInvoices = await SkuInvoiceHistory.count({
      where: { 
        status: 'active',
        company_id: req.user.company_id
      }
    });

    // Format response data
    const totalPages = Math.ceil(totalCount / limit);

    const responseData = {
      data: invoices,
      dashboard: {
        totalInvoiceAmount,
        totalItemsCount,
        totalInvoices
      },
      pagination: {
        totalCount,
        totalPages,
        currentPage: parseInt(page),
        pageSize: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    };

    res.status(200).json(responseData);
  } catch (error) {
    logger.error("Error fetching invoices:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

// Get invoice history by ID
v1Router.get("/invoice-history/:id", authenticateJWT, async (req, res) => {
  try {
    const invoice = await SkuInvoiceHistory.findOne({
      where: { 
        id: req.params.id,
        company_id: req.user.company_id 
      },
      include: [
        {
          model: Sku,
          attributes: ['id', 'sku_name'],
          required: false,
        },
        {
          model: Client,
          attributes: ['client_id', 'client_name'],
          required: false,
        },
        {
          model: User,
          as: "creator_SkuInvoiceHistory",
          attributes: ['id', 'name'],
          required: false,
        },
        {
          model: User,
          as: "updater_invoice",
          attributes: ['id', 'name'],
          required: false,
        }
      ]
    });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    res.status(200).json({ data: invoice });
  } catch (error) {
    logger.error("Error fetching invoice:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

// Update invoice history
v1Router.put("/invoice-history/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    // Define allowed fields to update
    const allowedFields = [
      "invoice_number", 
      "date", 
      "quantity", 
      "rate_per_sku", 
      "cost"
    ];

    // Find the current invoice
    const currentInvoice = await SkuInvoiceHistory.findOne({
      where: { 
        id: req.params.id,
        company_id: req.user.company_id
      },
      transaction
    });

    if (!currentInvoice) {
      await transaction.rollback();
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Filter request body to only include allowed fields
    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // Add updated_by
    updateData.updated_by = req.user.id;
    updateData.updated_at = new Date();

    // Check if invoice number is being changed and if it already exists
    if (updateData.invoice_number && updateData.invoice_number !== currentInvoice.invoice_number) {
      const existingInvoice = await SkuInvoiceHistory.findOne({
        where: {
          invoice_number: updateData.invoice_number,
          id: { [Op.ne]: req.params.id }
        },
        transaction
      });

      if (existingInvoice) {
        await transaction.rollback();
        return res.status(400).json({
          message: "Invoice number already exists. Please use a different number."
        });
      }
    }

    // Check if there are any valid fields to update
    if (Object.keys(updateData).length <= 1) { // 1 is for updated_by
      await transaction.rollback();
      return res.status(400).json({
        message: "No updatable fields provided."
      });
    }

    // Perform the update
    const [updatedCount] = await SkuInvoiceHistory.update(updateData, {
      where: { 
        id: req.params.id,
        company_id: req.user.company_id
      },
      transaction
    });

    if (updatedCount === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: "Invoice not found." });
    }

    // Fetch the updated invoice to return to the client
    const updatedInvoice = await SkuInvoiceHistory.findByPk(req.params.id, { 
      transaction,
      include: [
        {
          model: Sku,
          attributes: ['id', 'sku_name'],
          required: false,
        },
        {
          model: Client,
          attributes: ['client_id', 'client_name'],
          required: false,
        }
      ] 
    });

    // Commit the transaction
    await transaction.commit();

    // Publish update to queue
    await publishToQueue({
      operation: "UPDATE_INVOICE",
      invoiceId: req.params.id,
      timestamp: new Date(),
      data: updateData,
    });

    return res.status(200).json({
      message: "Invoice updated successfully.",
      updatedData: updatedInvoice,
    });
  } catch (error) {
    console.log(error, "Error in Invoice Update");
    // Rollback the transaction on error
    await transaction.rollback();
    return res.status(500).json({
      message: "Error updating invoice.",
      error: error.message,
    });
  }
});

// Soft Delete invoice history (changes status to inactive)
v1Router.delete("/invoice-history/:id", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Update status to inactive instead of deleting
    const updatedInvoice = await SkuInvoiceHistory.update(
      {
        status: "inactive",
        updated_at: new Date(),
        updated_by: req.user.id,
      },
      {
        where: { 
          id: req.params.id,
          company_id: req.user.company_id
        },
        transaction: t,
      }
    );

    if (!updatedInvoice[0])
      return res.status(404).json({ message: "Invoice not found" });

    await t.commit();
    await publishToQueue({
      operation: "SOFT_DELETE_INVOICE",
      invoiceId: req.params.id,
      timestamp: new Date(),
      data: { status: "inactive" },
    });
    res.status(200).json({ message: "Invoice marked as inactive successfully" });
  } catch (error) {
    await t.rollback();
    res
      .status(500)
      .json({ message: "Error deactivating invoice", error: error.message });
  }
});

// Export invoice history to Excel
v1Router.get("/invoice-history/export/excel", authenticateJWT, async (req, res) => {
  try {
    const { client_id, sku_id, date_from, date_to } = req.query;

    // Build the where condition for filters
    let whereCondition = {
      status: "active",
      company_id: req.user.company_id
    };

    if (client_id) whereCondition.client_id = client_id;
    if (sku_id) whereCondition.sku_id = sku_id;
    
    // Handle date range if provided
    if (date_from && date_to) {
      whereCondition.date = {
        [Op.between]: [date_from, date_to]
      };
    } else if (date_from) {
      whereCondition.date = {
        [Op.gte]: date_from
      };
    } else if (date_to) {
      whereCondition.date = {
        [Op.lte]: date_to
      };
    }

    // Fetch all invoices based on filters
    const invoices = await SkuInvoiceHistory.findAll({
      where: whereCondition,
      include: [
        {
          model: Sku,
          attributes: ['id', 'sku_name'],
          required: false,
        },
        {
          model: Client,
          attributes: ['client_id', 'client_name'],
          required: false,
        }
      ],
      order: [['date', 'DESC']]
    });

    // Create Excel workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Invoice History');

    // Add columns to the worksheet
    worksheet.columns = [
      { header: 'Invoice Number', key: 'invoice_number', width: 20 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Client', key: 'client_name', width: 25 },
      { header: 'SKU', key: 'sku_name', width: 25 },
      { header: 'Quantity', key: 'quantity', width: 15 },
      { header: 'Rate/SKU', key: 'rate_per_sku', width: 15 },
      { header: 'Total Cost', key: 'cost', width: 15 },
      { header: 'Created At', key: 'created_at', width: 20 }
    ];

    // Add style to header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };

    // Add data to the worksheet
    invoices.forEach(invoice => {
      worksheet.addRow({
        invoice_number: invoice.invoice_number,
        date: invoice.date,
        client_name: invoice.Client ? invoice.Client.client_name : 'N/A',
        sku_name: invoice.Sku ? invoice.Sku.sku_name : 'N/A',
        quantity: invoice.quantity,
        rate_per_sku: invoice.rate_per_sku,
        cost: invoice.cost,
        created_at: new Date(invoice.created_at).toLocaleString()
      });
    });

    // Set up response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=invoice_history.xlsx'
    );

    // Write workbook to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error("Error exporting invoice history:", error);
    res.status(500).json({
      message: "Error exporting invoice history",
      error: error.message,
    });
  }
});



addresses
clients
country
currencies
departments
designations
die
dropdown_names
dropdown_values
employee_details
flutes
global_currencies
grn
grn_items
inventory
inventory_type
item_master
machine_flow
machine_process_fields
machine_process_values
machines
packages
process_name
purchase_order_items
purchase_orders
role_user
roles
route
sales_order
sales_sku_details
sku
sku_type
sku_version
users
work_order
work_type