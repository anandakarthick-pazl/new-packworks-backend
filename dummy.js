

// Function to update layer production status when group status is completed
async function updateLayerProductionStatus(groupId, companyId, transaction = null) {
  try {
    // Get the production group (don't check status since we're updating it in the same transaction)
    const productionGroup = await ProductionGroup.findOne({
      where: {
        id: groupId,
        company_id: companyId
      },
      attributes: ['id', 'group_value', 'group_status'],  // Changed from 'status' to 'group_status'
      transaction
    });

    if (!productionGroup) {
      logger.warn(`Production group ${groupId} not found`);
      return { success: false, message: 'Production group not found' };
    }

    logger.info(`Processing group ${groupId} with group_value:`, productionGroup.group_value);

    // Parse group_value
    let groupValue = productionGroup.group_value;
    if (typeof groupValue === "string") {
      try {
        groupValue = JSON.parse(groupValue);
      } catch (parseError) {
        logger.error(`Error parsing group_value for group ${groupId}:`, parseError);
        return;
      }
    }

    if (!Array.isArray(groupValue) || groupValue.length === 0) {
      logger.warn(`No valid group_value found for group ${groupId}`);
      return { success: false, message: 'No valid group_value found' };
    }

    logger.info(`Found ${groupValue.length} items to process:`, groupValue);

    // Group layer IDs by work_order_id to minimize database queries
    const workOrderMap = {};
    groupValue.forEach(item => {
      const { work_order_id, layer_id } = item;
      if (!workOrderMap[work_order_id]) {
        workOrderMap[work_order_id] = [];
      }
      workOrderMap[work_order_id].push(layer_id);
    });

    // Process each unique work order
    for (const workOrderId of Object.keys(workOrderMap)) {
      const layerIds = workOrderMap[workOrderId];
      
      try {
        // Find the work order - break after finding the first match
        const workOrder = await WorkOrder.findByPk(workOrderId, {
          attributes: ['id', 'work_order_sku_values'],
          transaction
        });

        if (!workOrder) {
          logger.warn(`Work order ${workOrderId} not found`);
          continue; // Skip to next work order
        }

        logger.info(`Found work order ${workOrderId}, processing layers:`, layerIds);

        // Parse work_order_sku_values
        let skuValues = workOrder.work_order_sku_values;
        if (typeof skuValues === "string") {
          try {
            skuValues = JSON.parse(skuValues);
          } catch (parseError) {
            logger.error(`Error parsing work_order_sku_values for work order ${workOrderId}:`, parseError);
            continue;
          }
        }

        if (!Array.isArray(skuValues)) {
          logger.warn(`Invalid work_order_sku_values format for work order ${workOrderId}`);
          continue;
        }

        // Update production_status for matching layer_ids
        let updated = false;
        let updatedLayers = [];
        skuValues.forEach(layer => {
          if (layerIds.includes(layer.layer_id)) {
            layer.production_status = "completed";
            updated = true;
            updatedLayers.push(layer.layer_id);
          }
        });

        logger.info(`Updated layers ${updatedLayers.join(', ')} in work order ${workOrderId}`);

        // Save updated work order if any changes were made
        if (updated) {
          // For JSON columns, save the object directly - Sequelize will handle serialization
          await workOrder.update({
            work_order_sku_values: skuValues
          }, { transaction });
          
          logger.info(`Updated production status for work order ${workOrderId}, layers: ${layerIds.join(', ')}`);
        }

      } catch (error) {
        logger.error(`Error updating work order ${workOrderId}:`, error);
        continue; // Continue with next work order even if this one fails
      }
    }

    logger.info(`Successfully processed production group ${groupId} completion`);
    return { success: true, message: 'Layer production status updated successfully' };

  } catch (error) {
    logger.error(`Error updating layer production status for group ${groupId}:`, error);
    throw error;
  }
}
// Enhanced route with automatic layer status update
v1Router.put("/production-group/:id/complete", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { group_status } = req.body;

    logger.info(`Attempting to update production group ${id} to status: ${group_status}`);
    logger.info(`User company_id: ${req.user.company_id}`);
    logger.info(`User id: ${req.user.id}`);

    // First, check if the production group exists
    const existingGroup = await ProductionGroup.findOne({
      where: {
        id: id,
        company_id: req.user.company_id
      }
    });

    if (!existingGroup) {
      logger.error(`Production group ${id} not found for company ${req.user.company_id}`);
      return res.status(404).json({
        message: "Production group not found"
      });
    }

    logger.info(`Found production group:`, {
      id: existingGroup.id,
      current_status: existingGroup.group_status,  // Changed from 'status' to 'group_status'
      company_id: existingGroup.company_id
    });

    // First, update production group status in a separate transaction
    const productionTransaction = await sequelize.transaction();
    
    try {
      // Update production group status
      const [updatedRows] = await ProductionGroup.update(
        {
          group_status: group_status,  // Changed from 'status' to 'group_status'
          updated_by: req.user.id,
          updated_at: new Date()
        },
        {
          where: {
            id: id,
            company_id: req.user.company_id
          },
          transaction: productionTransaction
        }
      );

      logger.info(`Update query affected ${updatedRows} rows`);

      if (updatedRows === 0) {
        await productionTransaction.rollback();
        logger.error(`No rows updated for production group ${id}`);
        return res.status(404).json({
          message: "Production group not found or not updated"
        });
      }

      // Verify the update before committing
      const verifyUpdate = await ProductionGroup.findOne({
        where: {
          id: id,
          company_id: req.user.company_id
        },
        transaction: productionTransaction
      });

      logger.info(`After update, group status is: ${verifyUpdate?.group_status}`);

      // Commit the production group status update first
      await productionTransaction.commit();
      
      logger.info(`Production group ${id} status successfully committed to ${group_status}`);
      
    } catch (error) {
      await productionTransaction.rollback();
      logger.error(`Error in production group transaction:`, error);
      throw error;
    }

    // If status is being set to Completed, update layer production status in a separate transaction
    let layerUpdateResult = null;
    if (group_status === 'Completed') {
      try {
        const layerTransaction = await sequelize.transaction();
        layerUpdateResult = await updateLayerProductionStatus(id, req.user.company_id, layerTransaction);
        await layerTransaction.commit();
        logger.info(`Layer status updated for production group ${id}`);
      } catch (layerError) {
        logger.error(`Error updating layer status for group ${id}:`, layerError);
        layerUpdateResult = { success: false, message: 'Layer update failed', error: layerError.message };
      }
    }

    // Final verification - check the actual status in the database
    const finalCheck = await ProductionGroup.findOne({
      where: {
        id: id,
        company_id: req.user.company_id
      },
      attributes: ['id', 'group_status', 'updated_at']  // Changed from 'status' to 'group_status'
    });

    logger.info(`Final verification - Production group ${id} status: ${finalCheck?.group_status}`);

    res.status(200).json({
      message: "Production group status updated successfully",
      data: {
        id: id,
        status: group_status,
        actual_status_in_db: finalCheck?.group_status,  // Changed from 'status' to 'group_status'
        layers_updated: group_status === 'Completed',
        layer_update_result: layerUpdateResult,
        updated_at: finalCheck?.updated_at
      }
    });

  } catch (error) {
    logger.error("Error updating production group status:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
});



v1Router.patch("/production-group/:id/temporary-status", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { temporary_status } = req.body;

  if (typeof temporary_status === 'undefined') {
    return res.status(400).json({ message: "temporary_status is required" });
  }

  try {
    const [updatedCount] = await ProductionGroup.update(
      { temporary_status },
      {
        where: { id, company_id: req.user.company_id },
      }
    );
    if (updatedCount === 0) {
      return res.status(404).json({ message: "Production group not found or not updated" });
    }
    res.json({ message: "temporary_status updated successfully", id, temporary_status });
  } catch (error) {
    logger.error("Error updating temporary_status:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});