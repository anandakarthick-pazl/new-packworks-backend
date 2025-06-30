import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

const ProductionGroup = db.ProductionGroup;
const WorkOrder = db.WorkOrder;
const Inventory = db.Inventory;
const AllocationHistory = db.AllocationHistory;
const User = db.User;


// POST create new work order
v1Router.post("/production-group", authenticateJWT, async (req, res) => {
  const groupDetailsArray = req.body;

  // Validate that we received an array
  if (!Array.isArray(groupDetailsArray) || groupDetailsArray.length === 0) {
    return res
      .status(400)
      .json({
        message: "Invalid input data - expected array of group objects",
      });
  }

  const createdGroups = [];
  const errors = [];

  try {
    // Process each group in the array
    for (let i = 0; i < groupDetailsArray.length; i++) {
      const groupDetails = groupDetailsArray[i];

      try {
        // Validate required fields for this group
        if (!groupDetails.group_name) {
          errors.push(`Group at index ${i}: Group name is required`);
          continue;
        }

        // Create Production Group
        const newProductionGroup = await ProductionGroup.create({
          company_id: req.user.company_id,
          group_name: groupDetails.group_name,
          group_value: groupDetails.group_value || null,
          group_Qty: groupDetails.group_Qty || null,
          allocated_Qty: groupDetails.allocated_Qty || null,
          status: groupDetails.status || "active",
          created_by: req.user.id,
          updated_by: req.user.id,
          temporary_status: typeof groupDetails.temporary_status !== 'undefined' ? groupDetails.temporary_status : 0,
        });

        // Process group_value array to update work_order status
        if (
          groupDetails.group_value &&
          Array.isArray(groupDetails.group_value)
        ) {
          console.log(
            `Processing group_value array for group ${i}:`,
            groupDetails.group_value
          );

          for (const item of groupDetails.group_value) {
            const { work_order_id, layer_id } = item;
            console.log(
              `Processing item - work_order_id: ${work_order_id}, layer_id: ${layer_id}`
            );

            if (work_order_id && layer_id) {
              // Find work order by id
              const workOrder = await WorkOrder.findByPk(work_order_id);
              console.log(`Found work order:`, workOrder ? "Yes" : "No");

              if (workOrder && workOrder.work_order_sku_values) {
                console.log(
                  "Original work_order_sku_values:",
                  workOrder.work_order_sku_values
                );
                console.log(
                  "Type of work_order_sku_values:",
                  typeof workOrder.work_order_sku_values
                );

                let skuValues = workOrder.work_order_sku_values;

                // Parse if it's a JSON string, otherwise use as-is if it's already an array
                if (typeof skuValues === "string") {
                  try {
                    skuValues = JSON.parse(skuValues);
                    console.log("Parsed sku values:", skuValues);
                  } catch (parseError) {
                    logger.error(
                      `Error parsing work_order_sku_values for work_order_id ${work_order_id}:`,
                      parseError
                    );
                    continue;
                  }
                }

                // Update status for matching layer_id
                if (Array.isArray(skuValues)) {
                  console.log(
                    `Looking for layer_id: ${layer_id} in array of ${skuValues.length} items`
                  );

                  let updated = false;
                  const updatedSkuValues = skuValues.map((layer, index) => {
                    console.log(`Processing layer ${index}:`, {
                      layer_id: layer.layer_id,
                      layer_status: layer.layer_status,
                      matches_target: layer.layer_id === layer_id,
                      is_ungrouped: layer.layer_status === "ungrouped",
                    });

                    // Important: Make sure layer_id comparison uses correct data types
                    // Convert both to numbers for comparison to avoid type mismatch
                    const layerIdNum = Number(layer.layer_id);
                    const targetLayerIdNum = Number(layer_id);

                    if (
                      layerIdNum === targetLayerIdNum &&
                      layer.layer_status === "ungrouped"
                    ) {
                      updated = true;
                      console.log(
                        `✅ Updating layer_id ${layer_id} from 'ungrouped' to 'grouped'`
                      );
                      return { ...layer, layer_status: "grouped" };
                    }
                    return layer;
                  });

                  console.log(`Update needed: ${updated}`);

                  // Update work order if any changes were made
                  if (updated) {
                    console.log("Updated sku values:", updatedSkuValues);

                    // Store as JavaScript object/array - Sequelize will handle JSON serialization
                    const finalSkuValues = updatedSkuValues;

                    console.log("Final sku values to save:", finalSkuValues);

                    const updateResult = await WorkOrder.update(
                      {
                        work_order_sku_values: finalSkuValues,
                        updated_by: req.user.id,
                      },
                      {
                        where: { id: work_order_id },
                        returning: true, // This will help us see if the update actually happened
                      }
                    );

                    console.log("Update result:", updateResult);

                    logger.info(
                      `Successfully updated layer_id ${layer_id} to 'grouped' status in work_order_id ${work_order_id}`
                    );
                  } else {
                    console.log(
                      `❌ No update needed for layer_id ${layer_id} in work_order_id ${work_order_id}`
                    );

                    // Let's see what layers we actually have
                    console.log(
                      "Available layers:",
                      skuValues.map((l) => ({
                        layer_id: l.layer_id,
                        layer_status: l.layer_status,
                        type_of_layer_id: typeof l.layer_id,
                      }))
                    );

                    logger.warn(
                      `No update needed for layer_id ${layer_id} in work_order_id ${work_order_id} - layer not found or already grouped`
                    );
                  }
                } else {
                  console.log(
                    "❌ work_order_sku_values is not an array:",
                    typeof skuValues
                  );
                  logger.error(
                    `work_order_sku_values is not an array for work_order_id ${work_order_id}`
                  );
                }
              } else {
                console.log(
                  `❌ Work order not found or missing work_order_sku_values for work_order_id: ${work_order_id}`
                );
                logger.warn(
                  `Work order not found or missing work_order_sku_values for work_order_id: ${work_order_id}`
                );
              }
            } else {
              console.log(
                `❌ Missing work_order_id or layer_id in group_value item:`,
                item
              );
              logger.warn(
                `Missing work_order_id or layer_id in group_value item:`,
                item
              );
            }
          }
        }

        createdGroups.push(newProductionGroup);
        console.log(
          `✅ Successfully created group ${i}: ${groupDetails.group_name}`
        );
      } catch (groupError) {
        console.error(`Error creating group at index ${i}:`, groupError);
        logger.error(`Error creating group at index ${i}:`, groupError);
        errors.push(`Group at index ${i}: ${groupError.message}`);
      }
    }

    // Prepare response
    const response = {
      message: `Processed ${groupDetailsArray.length} groups`,
      created_count: createdGroups.length,
      error_count: errors.length,
      data: createdGroups,
    };

    if (errors.length > 0) {
      response.errors = errors;
    }

    // Return appropriate status code
    if (createdGroups.length > 0 && errors.length === 0) {
      // All groups created successfully
      res.status(201).json(response);
    } else if (createdGroups.length > 0 && errors.length > 0) {
      // Some groups created, some failed
      res.status(207).json(response); // 207 Multi-Status
    } else {
      // No groups created (all failed)
      res.status(400).json(response);
    }
  } catch (error) {
    console.error("Error processing production groups:", error);
    logger.error("Error processing production groups:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

v1Router.put("/production-group", authenticateJWT, async (req, res) => {
  const groupDetailsArray = req.body;

  // Validate that we received an array
  if (!Array.isArray(groupDetailsArray) || groupDetailsArray.length === 0) {
    return res
      .status(400)
      .json({
        message: "Invalid input data - expected array of group objects",
      });
  }

  const updatedGroups = [];
  const errors = [];

  try {
    // Process each group in the array
    for (let i = 0; i < groupDetailsArray.length; i++) {
      const groupDetails = groupDetailsArray[i];

      try {
        // Validate required fields for this group
        if (!groupDetails.id) {
          errors.push(`Group at index ${i}: Group ID is required for update`);
          continue;
        }

        if (!groupDetails.group_name) {
          errors.push(`Group at index ${i}: Group name is required`);
          continue;
        }

        // Check if the production group exists and belongs to the user's company
        const existingGroup = await ProductionGroup.findOne({
          where: {
            id: groupDetails.id,
            company_id: req.user.company_id
          }
        });

        if (!existingGroup) {
          errors.push(`Group at index ${i}: Production group not found or access denied`);
          continue;
        }

        // First, handle the removal of previous group_value items (set back to ungrouped)
        if (existingGroup.group_value && Array.isArray(existingGroup.group_value)) {
          console.log(`Processing existing group_value for removal - group ${i}:`, existingGroup.group_value);

          for (const item of existingGroup.group_value) {
            const { work_order_id, layer_id } = item;

            if (work_order_id && layer_id) {
              const workOrder = await WorkOrder.findByPk(work_order_id);

              if (workOrder && workOrder.work_order_sku_values) {
                let skuValues = workOrder.work_order_sku_values;

                if (typeof skuValues === "string") {
                  try {
                    skuValues = JSON.parse(skuValues);
                  } catch (parseError) {
                    logger.error(
                      `Error parsing work_order_sku_values for work_order_id ${work_order_id}:`,
                      parseError
                    );
                    continue;
                  }
                }

                if (Array.isArray(skuValues)) {
                  let updated = false;
                  const updatedSkuValues = skuValues.map((layer) => {
                    const layerIdNum = Number(layer.layer_id);
                    const targetLayerIdNum = Number(layer_id);

                    if (
                      layerIdNum === targetLayerIdNum &&
                      layer.layer_status === "grouped"
                    ) {
                      updated = true;
                      console.log(
                        `✅ Reverting layer_id ${layer_id} from 'grouped' to 'ungrouped'`
                      );
                      return { ...layer, layer_status: "ungrouped" };
                    }
                    return layer;
                  });

                  if (updated) {
                    await WorkOrder.update(
                      {
                        work_order_sku_values: updatedSkuValues,
                        updated_by: req.user.id,
                      },
                      {
                        where: { id: work_order_id },
                      }
                    );

                    logger.info(
                      `Reverted layer_id ${layer_id} to 'ungrouped' status in work_order_id ${work_order_id}`
                    );
                  }
                }
              }
            }
          }
        }

        // Update Production Group (Solution 2: Separate update and fetch)
        const [updatedRowsCount] = await ProductionGroup.update(
          {
            group_name: groupDetails.group_name,
            group_value: groupDetails.group_value || null,
            group_Qty: groupDetails.group_Qty || null,
            allocated_Qty: groupDetails.allocated_Qty || null,
            status: groupDetails.status || existingGroup.status,
            updated_by: req.user.id,
            temporary_status: typeof groupDetails.temporary_status !== 'undefined' ? groupDetails.temporary_status : existingGroup.temporary_status,
          },
          {
            where: { 
              id: groupDetails.id,
              company_id: req.user.company_id
            }
          }
        );

        if (updatedRowsCount === 0) {
          errors.push(`Group at index ${i}: Failed to update production group`);
          continue;
        }

        // Fetch the updated record
        const updatedProductionGroup = await ProductionGroup.findByPk(groupDetails.id);

        if (!updatedProductionGroup) {
          errors.push(`Group at index ${i}: Failed to retrieve updated production group`);
          continue;
        }

        // Parse JSON fields for proper response format
        const formattedGroup = {
          ...updatedProductionGroup.toJSON(),
          group_value: typeof updatedProductionGroup.group_value === 'string' 
            ? JSON.parse(updatedProductionGroup.group_value || '[]')
            : updatedProductionGroup.group_value
        };

        // Process new group_value array to update work_order status
        if (
          groupDetails.group_value &&
          Array.isArray(groupDetails.group_value)
        ) {
          console.log(
            `Processing new group_value array for group ${i}:`,
            groupDetails.group_value
          );

          for (const item of groupDetails.group_value) {
            const { work_order_id, layer_id } = item;
            console.log(
              `Processing item - work_order_id: ${work_order_id}, layer_id: ${layer_id}`
            );

            if (work_order_id && layer_id) {
              // Find work order by id
              const workOrder = await WorkOrder.findByPk(work_order_id);
              console.log(`Found work order:`, workOrder ? "Yes" : "No");

              if (workOrder && workOrder.work_order_sku_values) {
                console.log(
                  "Original work_order_sku_values:",
                  workOrder.work_order_sku_values
                );

                let skuValues = workOrder.work_order_sku_values;

                // Parse if it's a JSON string, otherwise use as-is if it's already an array
                if (typeof skuValues === "string") {
                  try {
                    skuValues = JSON.parse(skuValues);
                    console.log("Parsed sku values:", skuValues);
                  } catch (parseError) {
                    logger.error(
                      `Error parsing work_order_sku_values for work_order_id ${work_order_id}:`,
                      parseError
                    );
                    continue;
                  }
                }

                // Update status for matching layer_id
                if (Array.isArray(skuValues)) {
                  console.log(
                    `Looking for layer_id: ${layer_id} in array of ${skuValues.length} items`
                  );

                  let updated = false;
                  const updatedSkuValues = skuValues.map((layer, index) => {
                    console.log(`Processing layer ${index}:`, {
                      layer_id: layer.layer_id,
                      layer_status: layer.layer_status,
                      matches_target: layer.layer_id === layer_id,
                      is_ungrouped: layer.layer_status === "ungrouped",
                    });

                    // Convert both to numbers for comparison to avoid type mismatch
                    const layerIdNum = Number(layer.layer_id);
                    const targetLayerIdNum = Number(layer_id);

                    if (
                      layerIdNum === targetLayerIdNum &&
                      layer.layer_status === "ungrouped"
                    ) {
                      updated = true;
                      console.log(
                        `✅ Updating layer_id ${layer_id} from 'ungrouped' to 'grouped'`
                      );
                      return { ...layer, layer_status: "grouped" };
                    }
                    return layer;
                  });

                  console.log(`Update needed: ${updated}`);

                  // Update work order if any changes were made
                  if (updated) {
                    console.log("Updated sku values:", updatedSkuValues);

                    const updateResult = await WorkOrder.update(
                      {
                        work_order_sku_values: updatedSkuValues,
                        updated_by: req.user.id,
                      },
                      {
                        where: { id: work_order_id },
                      }
                    );

                    console.log("Update result:", updateResult);

                    logger.info(
                      `Successfully updated layer_id ${layer_id} to 'grouped' status in work_order_id ${work_order_id}`
                    );
                  } else {
                    console.log(
                      `❌ No update needed for layer_id ${layer_id} in work_order_id ${work_order_id}`
                    );

                    // Let's see what layers we actually have
                    console.log(
                      "Available layers:",
                      skuValues.map((l) => ({
                        layer_id: l.layer_id,
                        layer_status: l.layer_status,
                        type_of_layer_id: typeof l.layer_id,
                      }))
                    );

                    logger.warn(
                      `No update needed for layer_id ${layer_id} in work_order_id ${work_order_id} - layer not found or already grouped`
                    );
                  }
                } else {
                  console.log(
                    "❌ work_order_sku_values is not an array:",
                    typeof skuValues
                  );
                  logger.error(
                    `work_order_sku_values is not an array for work_order_id ${work_order_id}`
                  );
                }
              } else {
                console.log(
                  `❌ Work order not found or missing work_order_sku_values for work_order_id: ${work_order_id}`
                );
                logger.warn(
                  `Work order not found or missing work_order_sku_values for work_order_id: ${work_order_id}`
                );
              }
            } else {
              console.log(
                `❌ Missing work_order_id or layer_id in group_value item:`,
                item
              );
              logger.warn(
                `Missing work_order_id or layer_id in group_value item:`,
                item
              );
            }
          }
        }

        updatedGroups.push(formattedGroup);
        console.log(
          `✅ Successfully updated group ${i}: ${groupDetails.group_name}`
        );
      } catch (groupError) {
        console.error(`Error updating group at index ${i}:`, groupError);
        logger.error(`Error updating group at index ${i}:`, groupError);
        errors.push(`Group at index ${i}: ${groupError.message}`);
      }
    }

    // Prepare response
    const response = {
      message: `Processed ${groupDetailsArray.length} groups for update`,
      updated_count: updatedGroups.length,
      error_count: errors.length,
      data: updatedGroups,
    };

    if (errors.length > 0) {
      response.errors = errors;
    }

    // Return appropriate status code
    if (updatedGroups.length > 0 && errors.length === 0) {
      // All groups updated successfully
      res.status(200).json(response);
    } else if (updatedGroups.length > 0 && errors.length > 0) {
      // Some groups updated, some failed
      res.status(207).json(response); // 207 Multi-Status
    } else {
      // No groups updated (all failed)
      res.status(400).json(response);
    }
  } catch (error) {
    console.error("Error updating production groups:", error);
    logger.error("Error updating production groups:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// single group delete
v1Router.delete("/production-group/:id", authenticateJWT, async (req, res) => {
  const groupId = req.params.id;

  // Validate group ID
  if (!groupId || isNaN(groupId)) {
    return res.status(400).json({
      message: "Invalid group ID provided",
    });
  }

  try {
    // Find the production group first
    const productionGroup = await ProductionGroup.findByPk(groupId);

    if (!productionGroup) {
      return res.status(404).json({
        message: "Production group not found",
      });
    }

    // Check if user has permission to delete this group (same company)
    if (productionGroup.company_id !== req.user.company_id) {
      return res.status(403).json({
        message: "Access denied - you can only delete groups from your company",
      });
    }

    console.log(`Starting deletion process for group ID: ${groupId}`);
    console.log("Group details:", {
      group_name: productionGroup.group_name,
      group_value: productionGroup.group_value,
    });

    // Add this critical debug info to the response
    // const debugInfo = {
    //   group_value_exists: !!productionGroup.group_value,
    //   group_value_type: typeof productionGroup.group_value,
    //   group_value_is_array: Array.isArray(productionGroup.group_value),
    //   group_value_content: productionGroup.group_value,
    // };

    const updatedWorkOrders = [];
    const updateErrors = [];

    // Process group_value to revert layer status back to "ungrouped"
    let groupValueToProcess = productionGroup.group_value;
    
    // Handle different possible formats of group_value
    if (typeof groupValueToProcess === 'string') {
      try {
        groupValueToProcess = JSON.parse(groupValueToProcess);
        console.log("✅ Parsed group_value from JSON string");
      } catch (e) {
        console.log("❌ Failed to parse group_value as JSON:", e);
        groupValueToProcess = null;
      }
    }
    
    if (groupValueToProcess && Array.isArray(groupValueToProcess)) {
      console.log("=== PROCESSING GROUP_VALUE FOR DELETION ===");
      console.log("Group value:", JSON.stringify(groupValueToProcess, null, 2));

      for (const item of groupValueToProcess) {
        const { work_order_id, layer_id } = item;
        console.log(`\n🔍 Processing: work_order_id=${work_order_id}, layer_id=${layer_id}`);

        if (work_order_id && layer_id) {
          try {
            // Find work order by id
            const workOrder = await WorkOrder.findByPk(work_order_id);
            console.log(`WorkOrder found: ${workOrder ? 'YES' : 'NO'}`);

            if (workOrder && workOrder.work_order_sku_values) {
              let skuValues = workOrder.work_order_sku_values;
              console.log("Original sku_values type:", typeof skuValues);

              // Parse if it's a JSON string
              if (typeof skuValues === "string") {
                try {
                  skuValues = JSON.parse(skuValues);
                  console.log("✅ Parsed JSON string successfully");
                } catch (parseError) {
                  console.error("❌ JSON Parse Error:", parseError);
                  updateErrors.push(`Failed to parse work_order_sku_values for work_order_id ${work_order_id}`);
                  continue;
                }
              }

              if (Array.isArray(skuValues)) {
                console.log(`📋 Found ${skuValues.length} layers in work order`);
                
                // Show all layers for debugging
                skuValues.forEach((layer, idx) => {
                  console.log(`  Layer ${idx}: id=${layer.layer_id}, status=${layer.layer_status}`);
                });

                let updated = false;
                const revertedSkuValues = skuValues.map((layer) => {
                  // Convert both to numbers for comparison
                  const layerIdNum = Number(layer.layer_id);
                  const targetLayerIdNum = Number(layer_id);
                  const isTargetLayer = layerIdNum === targetLayerIdNum;
                  const isGrouped = layer.layer_status === "grouped";

                  console.log(`  Checking layer_id ${layer.layer_id}: isTarget=${isTargetLayer}, isGrouped=${isGrouped}`);

                  if (isTargetLayer && isGrouped) {
                    updated = true;
                    console.log(`    ✅ REVERTING layer_id ${layer_id} from 'grouped' to 'ungrouped'`);
                    return { ...layer, layer_status: "ungrouped" };
                  }
                  return layer;
                });

                if (updated) {
                  console.log("💾 Updating work order with reverted values...");
                  
                  await WorkOrder.update(
                    {
                      work_order_sku_values: revertedSkuValues,
                      updated_by: req.user.id,
                    },
                    {
                      where: { id: work_order_id },
                    }
                  );

                  updatedWorkOrders.push({
                    work_order_id,
                    layer_id,
                    status: "reverted to ungrouped",
                  });

                  console.log("✅ Successfully updated work order");
                } else {
                  console.log(`❌ No update needed - layer_id ${layer_id} not found or not grouped`);
                }
              } else {
                console.log("❌ sku_values is not an array after parsing");
                updateErrors.push(`work_order_sku_values is not an array for work_order_id ${work_order_id}`);
              }
            } else {
              console.log(`❌ Work order ${work_order_id} not found or has no sku_values`);
              updateErrors.push(`Work order not found or missing sku_values for work_order_id ${work_order_id}`);
            }
          } catch (updateError) {
            console.error(`❌ Error processing work order ${work_order_id}:`, updateError);
            updateErrors.push(`Failed to update work_order_id ${work_order_id}: ${updateError.message}`);
          }
        } else {
          console.log(`❌ Missing work_order_id or layer_id in item:`, item);
          updateErrors.push(`Missing work_order_id or layer_id in group_value item`);
        }
      }
      console.log("=== PROCESSING COMPLETE ===\n");
    } else {
      console.log("❌ No valid group_value found");
      console.log("group_value type:", typeof productionGroup.group_value);
      console.log("group_value content:", productionGroup.group_value);
      console.log("Is array:", Array.isArray(productionGroup.group_value));
    }

    // Now delete the production group
    await ProductionGroup.destroy({
      where: { 
        id: groupId,
        company_id: req.user.company_id // Additional safety check
      },
    });

    console.log(`✅ Successfully deleted production group ID: ${groupId}`);
    logger.info(`Production group ${groupId} deleted by user ${req.user.id}`);

    // Prepare response
    const response = {
      message: "Production group deleted successfully",
      deleted_group: {
        id: productionGroup.id,
        group_name: productionGroup.group_name,
      },
      updated_work_orders: updatedWorkOrders,
      total_layers_reverted: updatedWorkOrders.length,
      // debug_info: debugInfo, 
    };

    // Include update errors if any occurred
    if (updateErrors.length > 0) {
      response.update_errors = updateErrors;
      response.message += ` (with ${updateErrors.length} layer update errors)`;
    }

    res.status(200).json(response);

  } catch (error) {
    console.error("Error deleting production group:", error);
    logger.error("Error deleting production group:", error);
    res.status(500).json({ 
      message: "Internal Server Error", 
      error: error.message 
    });
  }
});

// multiple group delete
v1Router.delete("/production-groups", authenticateJWT, async (req, res) => {
  const { groupIds } = req.body;

  // Validate input
  if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
    return res.status(400).json({
      message: "Invalid input - groupIds must be a non-empty array",
    });
  }

  // Validate all group IDs
  const invalidIds = groupIds.filter(id => !id || isNaN(id));
  if (invalidIds.length > 0) {
    return res.status(400).json({
      message: "Invalid group IDs provided",
      invalid_ids: invalidIds,
    });
  }

  try {
    console.log(`Starting deletion process for ${groupIds.length} groups:`, groupIds);

    const deletionResults = [];
    const errors = [];
    let totalLayersReverted = 0;

    // Process each group
    for (const groupId of groupIds) {
      try {
        console.log(`\n=== Processing Group ID: ${groupId} ===`);
        
        // Find the production group first
        const productionGroup = await ProductionGroup.findByPk(groupId);

        if (!productionGroup) {
          errors.push({
            group_id: groupId,
            error: "Production group not found",
          });
          continue;
        }

        // Check if user has permission to delete this group (same company)
        if (productionGroup.company_id !== req.user.company_id) {
          errors.push({
            group_id: groupId,
            error: "Access denied - you can only delete groups from your company",
          });
          continue;
        }

        console.log("Group details:", {
          group_name: productionGroup.group_name,
          group_value: productionGroup.group_value,
        });

        const updatedWorkOrders = [];
        const updateErrors = [];

        // Process group_value to revert layer status back to "ungrouped"
        let groupValueToProcess = productionGroup.group_value;
        
        // Handle different possible formats of group_value
        if (typeof groupValueToProcess === 'string') {
          try {
            groupValueToProcess = JSON.parse(groupValueToProcess);
            console.log("✅ Parsed group_value from JSON string");
          } catch (e) {
            console.log("❌ Failed to parse group_value as JSON:", e);
            groupValueToProcess = null;
          }
        }
        
        if (groupValueToProcess && Array.isArray(groupValueToProcess)) {
          console.log("=== PROCESSING GROUP_VALUE FOR DELETION ===");
          console.log("Group value:", JSON.stringify(groupValueToProcess, null, 2));

          for (const item of groupValueToProcess) {
            const { work_order_id, layer_id } = item;
            console.log(`\n🔍 Processing: work_order_id=${work_order_id}, layer_id=${layer_id}`);

            if (work_order_id && layer_id) {
              try {
                // Find work order by id
                const workOrder = await WorkOrder.findByPk(work_order_id);
                console.log(`WorkOrder found: ${workOrder ? 'YES' : 'NO'}`);

                if (workOrder && workOrder.work_order_sku_values) {
                  let skuValues = workOrder.work_order_sku_values;
                  console.log("Original sku_values type:", typeof skuValues);

                  // Parse if it's a JSON string
                  if (typeof skuValues === "string") {
                    try {
                      skuValues = JSON.parse(skuValues);
                      console.log("✅ Parsed JSON string successfully");
                    } catch (parseError) {
                      console.error("❌ JSON Parse Error:", parseError);
                      updateErrors.push(`Failed to parse work_order_sku_values for work_order_id ${work_order_id}`);
                      continue;
                    }
                  }

                  if (Array.isArray(skuValues)) {
                    console.log(`📋 Found ${skuValues.length} layers in work order`);
                    
                    // Show all layers for debugging
                    skuValues.forEach((layer, idx) => {
                      console.log(`  Layer ${idx}: id=${layer.layer_id}, status=${layer.layer_status}`);
                    });

                    let updated = false;
                    const revertedSkuValues = skuValues.map((layer) => {
                      // Convert both to numbers for comparison
                      const layerIdNum = Number(layer.layer_id);
                      const targetLayerIdNum = Number(layer_id);
                      const isTargetLayer = layerIdNum === targetLayerIdNum;
                      const isGrouped = layer.layer_status === "grouped";

                      console.log(`  Checking layer_id ${layer.layer_id}: isTarget=${isTargetLayer}, isGrouped=${isGrouped}`);

                      if (isTargetLayer && isGrouped) {
                        updated = true;
                        console.log(`    ✅ REVERTING layer_id ${layer_id} from 'grouped' to 'ungrouped'`);
                        return { ...layer, layer_status: "ungrouped" };
                      }
                      return layer;
                    });

                    if (updated) {
                      console.log("💾 Updating work order with reverted values...");
                      
                      await WorkOrder.update(
                        {
                          work_order_sku_values: revertedSkuValues,
                          updated_by: req.user.id,
                        },
                        {
                          where: { id: work_order_id },
                        }
                      );

                      updatedWorkOrders.push({
                        work_order_id,
                        layer_id,
                        status: "reverted to ungrouped",
                      });

                      console.log("✅ Successfully updated work order");
                    } else {
                      console.log(`❌ No update needed - layer_id ${layer_id} not found or not grouped`);
                    }
                  } else {
                    console.log("❌ sku_values is not an array after parsing");
                    updateErrors.push(`work_order_sku_values is not an array for work_order_id ${work_order_id}`);
                  }
                } else {
                  console.log(`❌ Work order ${work_order_id} not found or has no sku_values`);
                  updateErrors.push(`Work order not found or missing sku_values for work_order_id ${work_order_id}`);
                }
              } catch (updateError) {
                console.error(`❌ Error processing work order ${work_order_id}:`, updateError);
                updateErrors.push(`Failed to update work_order_id ${work_order_id}: ${updateError.message}`);
              }
            } else {
              console.log(`❌ Missing work_order_id or layer_id in item:`, item);
              updateErrors.push(`Missing work_order_id or layer_id in group_value item`);
            }
          }
          console.log("=== PROCESSING COMPLETE ===\n");
        } else {
          console.log("❌ No valid group_value found");
          console.log("group_value type:", typeof productionGroup.group_value);
          console.log("group_value content:", productionGroup.group_value);
          console.log("Is array:", Array.isArray(productionGroup.group_value));
        }

        // Now delete the production group
        await ProductionGroup.destroy({
          where: { 
            id: groupId,
            company_id: req.user.company_id // Additional safety check
          },
        });

        console.log(`✅ Successfully deleted production group ID: ${groupId}`);
        logger.info(`Production group ${groupId} deleted by user ${req.user.id}`);

        // Add to successful deletions
        const groupResult = {
          group_id: groupId,
          group_name: productionGroup.group_name,
          updated_work_orders: updatedWorkOrders,
          layers_reverted: updatedWorkOrders.length,
          status: "deleted successfully",
        };

        // Include update errors if any occurred for this group
        if (updateErrors.length > 0) {
          groupResult.update_errors = updateErrors;
          groupResult.status = `deleted with ${updateErrors.length} layer update errors`;
        }

        deletionResults.push(groupResult);
        totalLayersReverted += updatedWorkOrders.length;

      } catch (groupError) {
        console.error(`Error processing group ${groupId}:`, groupError);
        errors.push({
          group_id: groupId,
          error: `Failed to delete group: ${groupError.message}`,
        });
      }
    }

    // Prepare final response
    const response = {
      message: `Processed ${groupIds.length} groups`,
      summary: {
        total_requested: groupIds.length,
        successfully_deleted: deletionResults.length,
        failed: errors.length,
        total_layers_reverted: totalLayersReverted,
      },
      deleted_groups: deletionResults,
    };

    // Include errors if any occurred
    if (errors.length > 0) {
      response.errors = errors;
      response.message += ` (${errors.length} failed)`;
    }

    // Determine response status
    const statusCode = errors.length === 0 ? 200 : 
                      deletionResults.length === 0 ? 400 : 207; // 207 = Multi-Status

    res.status(statusCode).json(response);

  } catch (error) {
    console.error("Error in bulk deletion process:", error);
    logger.error("Error in bulk deletion process:", error);
    res.status(500).json({ 
      message: "Internal Server Error", 
      error: error.message 
    });
  }
});

// POST create new production - reset temporary status and update production value
v1Router.post("/new", authenticateJWT, async (req, res) => {
  try {
    console.log("Starting production/new process...");
    logger.info("Starting production/new process");

    // Step 1: Update ProductionGroup table - set temporary_status from 1 to 0
    console.log("Step 1: Updating ProductionGroup temporary_status...");
    
    const productionGroupUpdateResult = await ProductionGroup.update(
      { 
        temporary_status: 0,
        updated_by: req.user.id 
      },
      {
        where: { 
          temporary_status: 1,
          company_id: req.user.company_id 
        },
        returning: true
      }
    );

    console.log(`ProductionGroup update result: ${productionGroupUpdateResult[0]} rows affected`);
    logger.info(`Updated ${productionGroupUpdateResult[0]} ProductionGroup records from temporary_status 1 to 0`);

    // Step 2: Update WorkOrder table - set temporary_status from 1 to 0 and in_production to "created"
    console.log("Step 2: Updating WorkOrder temporary_status and in_production...");
    
    const workOrderUpdateResult = await WorkOrder.update(
      { 
        temporary_status: 0,
        // production: "created",
        updated_by: req.user.id 
      },
      {
        where: { 
          temporary_status: 1,
          company_id: req.user.company_id 
        },
        returning: true
      }
    );

    console.log(`WorkOrder update result: ${workOrderUpdateResult[0]} rows affected`);
    logger.info(`Updated ${workOrderUpdateResult[0]} WorkOrder records from temporary_status 1 to 0 and set in_production to "created"`);

    // Prepare response
    const response = {
      message: "Production process completed successfully",
      production_groups_updated: productionGroupUpdateResult[0],
      work_orders_updated: workOrderUpdateResult[0],
      timestamp: new Date().toISOString(),
      processed_by: req.user.id
    };

    console.log("✅ Production/new process completed successfully");
    logger.info("Production/new process completed successfully", response);

    res.status(200).json(response);

  } catch (error) {
    console.error("Error in production/new process:", error);
    logger.error("Error in production/new process:", error);
    
    res.status(500).json({ 
      message: "Internal Server Error during production process", 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

v1Router.get("/production-group", authenticateJWT, async (req, res) => {
  try {
    const { include_work_orders = "false", temporary_status } = req.query;

    // Build where clause
    const whereClause = {
      company_id: req.user.company_id,
    };

    // Add temporary_status filter if provided
    if (temporary_status) {
      whereClause.temporary_status = parseInt(temporary_status, 10);
    }

    // Get all production groups for the company
    const productionGroups = await ProductionGroup.findAll({
      where: whereClause,
      order: [["created_at", "DESC"]],
      attributes: [
        "id",
        "group_name",
        "group_value",
        "group_Qty",
        "allocated_Qty",
        "status",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
        "temporary_status",
      ],
    });

    // Process each production group to include work order layer details if requested
    const processedGroups = await Promise.all(
      productionGroups.map(async (group) => {
        const groupData = group.toJSON();

        // Parse group_value if it's a string
        let groupValue = groupData.group_value;
        if (typeof groupValue === "string") {
          try {
            groupValue = JSON.parse(groupValue);
          } catch (parseError) {
            logger.warn(
              `Error parsing group_value for group ${group.id}:`,
              parseError
            );
            groupValue = [];
          }
        }

        groupData.group_value = groupValue || [];

        // Calculate balance_Qty = group_Qty - allocated_Qty
        groupData.balance_Qty = (groupData.group_Qty || 0) - (groupData.allocated_Qty || 0);

        // Fetch allocation history for this group
        try {
          const allocationHistory = await AllocationHistory.findAll({
            where: {
              group_id: group.id,
              company_id: req.user.company_id,
            },
            attributes: [
              "id",
              "inventory_id",
              "allocated_qty",
              "status",
              "created_by",
              "updated_by",
              "created_at",
              "updated_at",
            ],
            order: [["created_at", "DESC"]],
          });

          // Process allocation history data
          const allocationData = allocationHistory.map(item => item.toJSON());
          
          // Calculate total allocated quantity by inventory_id
          const allocationSummary = {};
          let totalAllocatedQty = 0;
          
          allocationData.forEach(allocation => {
            const inventoryId = allocation.inventory_id;
            const allocatedQty = allocation.allocated_qty || 0;
            
            if (!allocationSummary[inventoryId]) {
              allocationSummary[inventoryId] = {
                inventory_id: inventoryId,
                total_allocated_qty: 0,
                allocation_records: []
              };
            }
            
            allocationSummary[inventoryId].total_allocated_qty += allocatedQty;
            allocationSummary[inventoryId].allocation_records.push(allocation);
            totalAllocatedQty += allocatedQty;
          });

          // Convert summary object to array
          const allocationSummaryArray = Object.values(allocationSummary);

          // Add allocation data to group
          groupData.allocation_history = {
            total_allocated_qty: totalAllocatedQty,
            allocation_by_inventory: allocationSummaryArray,
            all_allocation_records: allocationData
          };

        } catch (allocationError) {
          logger.error(
            `Error fetching allocation history for group ${group.id}:`,
            allocationError
          );
          groupData.allocation_history = {
            total_allocated_qty: 0,
            allocation_by_inventory: [],
            all_allocation_records: [],
            error: "Error fetching allocation history"
          };
        }

        // Include only layer details if requested
        if (include_work_orders === "true" && Array.isArray(groupValue)) {
          const layerDetails = await Promise.all(
            groupValue.map(async (item) => {
              const { work_order_id, layer_id, sales_order_id } = item;

              try {
                // Only fetch work_order_sku_values to extract layer details
                const workOrder = await WorkOrder.findByPk(work_order_id, {
                  attributes: ["id", "work_generate_id", "work_order_sku_values"],
                });

                if (!workOrder) {
                  return {
                    work_order_id,
                    layer_id,
                    sales_order_id,
                    layer_found: false,
                    error: "Work order not found",
                  };
                }

                // Parse work_order_sku_values to get layer details
                let skuValues = workOrder.work_order_sku_values;
                if (typeof skuValues === "string") {
                  try {
                    skuValues = JSON.parse(skuValues);
                  } catch (parseError) {
                    skuValues = [];
                  }
                }

                // Find the specific layer by layer_id
                const layerDetail = Array.isArray(skuValues)
                  ? skuValues.find((layer) => layer.layer_id === layer_id)
                  : null;

                if (!layerDetail) {
                  return {
                    work_order_id,
                    work_generate_id: workOrder.work_generate_id,
                    layer_id,
                    sales_order_id,
                    layer_found: false,
                    error: "Layer not found in work order",
                  };
                }

                return {
                  work_order_id,
                  work_generate_id: workOrder.work_generate_id,
                  layer_id,
                  sales_order_id,
                  layer_found: true,
                  layer_detail: layerDetail,
                };
              } catch (error) {
                logger.error(
                  `Error fetching layer details for work order ${work_order_id}:`,
                  error
                );
                return {
                  work_order_id,
                  layer_id,
                  sales_order_id,
                  layer_found: false,
                  error: "Error fetching layer details",
                };
              }
            })
          );

          groupData.layer_details = layerDetails;
        }

        return groupData;
      })
    );

    res.status(200).json({
      message: "Production groups retrieved successfully",
      data: processedGroups,
      total: processedGroups.length,
    });
  } catch (error) {
    logger.error("Error fetching production groups:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});


v1Router.get("/production-group/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { include_work_orders = "false" } = req.query;

    // Validate ID parameter
    if (!id) {
      return res.status(400).json({
        message: "Production group ID is required",
      });
    }

    // Get specific production group for the company
    const productionGroup = await ProductionGroup.findOne({
      where: {
        id: id,
        company_id: req.user.company_id,
      },
      attributes: [
        "id",
        "group_name",
        "group_value",
        "group_Qty",
        "allocated_Qty",
        "status",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
        "temporary_status",
      ],
    });

    // Check if production group exists
    if (!productionGroup) {
      return res.status(404).json({
        message: "Production group not found",
      });
    }

    // Process the production group data
    const groupData = productionGroup.toJSON();

    // Parse group_value if it's a string
    let groupValue = groupData.group_value;
    if (typeof groupValue === "string") {
      try {
        groupValue = JSON.parse(groupValue);
      } catch (parseError) {
        logger.warn(
          `Error parsing group_value for group ${productionGroup.id}:`,
          parseError
        );
        groupValue = [];
      }
    }

    groupData.group_value = groupValue || [];

    // Calculate balance_Qty = group_Qty - allocated_Qty
    groupData.balance_Qty = (groupData.group_Qty || 0) - (groupData.allocated_Qty || 0);

    // Fetch allocation history for this group
    try {
      const allocationHistory = await AllocationHistory.findAll({
        where: {
          group_id: productionGroup.id,
          company_id: req.user.company_id,
        },
        attributes: [
          "id",
          "inventory_id",
          "allocated_qty",
          "status",
          "created_by",
          "updated_by",
          "created_at",
          "updated_at",
        ],
        order: [["created_at", "DESC"]],
      });

      // Process allocation history data
      const allocationData = allocationHistory.map(item => item.toJSON());
      
      // Calculate total allocated quantity by inventory_id
      const allocationSummary = {};
      let totalAllocatedQty = 0;
      
      allocationData.forEach(allocation => {
        const inventoryId = allocation.inventory_id;
        const allocatedQty = allocation.allocated_qty || 0;
        
        if (!allocationSummary[inventoryId]) {
          allocationSummary[inventoryId] = {
            inventory_id: inventoryId,
            total_allocated_qty: 0,
            allocation_records: []
          };
        }
        
        allocationSummary[inventoryId].total_allocated_qty += allocatedQty;
        allocationSummary[inventoryId].allocation_records.push(allocation);
        totalAllocatedQty += allocatedQty;
      });

      // Convert summary object to array
      const allocationSummaryArray = Object.values(allocationSummary);

      // Add allocation data to group
      groupData.allocation_history = {
        total_allocated_qty: totalAllocatedQty,
        allocation_by_inventory: allocationSummaryArray,
        all_allocation_records: allocationData
      };

    } catch (allocationError) {
      logger.error(
        `Error fetching allocation history for group ${productionGroup.id}:`,
        allocationError
      );
      groupData.allocation_history = {
        total_allocated_qty: 0,
        allocation_by_inventory: [],
        all_allocation_records: [],
        error: "Error fetching allocation history"
      };
    }

    // Include only layer details if requested
    if (include_work_orders === "true" && Array.isArray(groupValue)) {
      const layerDetails = await Promise.all(
        groupValue.map(async (item) => {
          const { work_order_id, layer_id, sales_order_id } = item;

          try {
            // Only fetch work_order_sku_values to extract layer details
            const workOrder = await WorkOrder.findByPk(work_order_id, {
              attributes: ["id", "work_generate_id", "work_order_sku_values"],
            });

            if (!workOrder) {
              return {
                work_order_id,
                layer_id,
                sales_order_id,
                layer_found: false,
                error: "Work order not found",
              };
            }

            // Parse work_order_sku_values to get layer details
            let skuValues = workOrder.work_order_sku_values;
            if (typeof skuValues === "string") {
              try {
                skuValues = JSON.parse(skuValues);
              } catch (parseError) {
                skuValues = [];
              }
            }

            // Find the specific layer by layer_id
            const layerDetail = Array.isArray(skuValues)
              ? skuValues.find((layer) => layer.layer_id === layer_id)
              : null;

            if (!layerDetail) {
              return {
                work_order_id,
                work_generate_id: workOrder.work_generate_id,
                layer_id,
                sales_order_id,
                layer_found: false,
                error: "Layer not found in work order",
              };
            }

            return {
              work_order_id,
              work_generate_id: workOrder.work_generate_id,
              layer_id,
              sales_order_id,
              layer_found: true,
              layer_detail: layerDetail,
            };
          } catch (error) {
            logger.error(
              `Error fetching layer details for work order ${work_order_id}:`,
              error
            );
            return {
              work_order_id,
              layer_id,
              sales_order_id,
              layer_found: false,
              error: "Error fetching layer details",
            };
          }
        })
      );

      groupData.layer_details = layerDetails;
    }

    res.status(200).json({
      message: "Production group retrieved successfully",
      data: groupData,
    });
  } catch (error) {
    logger.error("Error fetching production group:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

v1Router.patch(
  "/production-group/allocate",
  authenticateJWT,
  async (req, res) => {
    const { allocations } = req.body;

    // Validate input
    if (
      !allocations ||
      !Array.isArray(allocations) ||
      allocations.length === 0
    ) {
      return res.status(400).json({
        message: "allocations array is required and must not be empty",
      });
    }

    // Start a database transaction
    const transaction = await sequelize.transaction();

    try {
      const allocationResults = [];
      const errors = [];

      for (let i = 0; i < allocations.length; i++) {
        const allocation = allocations[i];
        const { production_group_id, inventory_id, quantity_to_allocate } =
          allocation;

        try {
          // Validate required fields for this allocation
          if (!production_group_id || !inventory_id || !quantity_to_allocate) {
            errors.push(
              `Allocation at index ${i}: production_group_id, inventory_id, and quantity_to_allocate are required`
            );
            continue;
          }

          // Validate quantity is positive
          if (quantity_to_allocate <= 0) {
            errors.push(
              `Allocation at index ${i}: quantity_to_allocate must be greater than 0`
            );
            continue;
          }

          // Find the production group
          const productionGroup = await ProductionGroup.findOne({
            where: {
              id: production_group_id,
              company_id: req.user.company_id,
            },
            transaction,
          });

          if (!productionGroup) {
            errors.push(
              `Allocation at index ${i}: Production group not found or doesn't belong to your company`
            );
            continue;
          }

          // Find the inventory item
          const inventoryItem = await Inventory.findOne({
            where: {
              id: inventory_id,
              company_id: req.user.company_id,
            },
            transaction,
          });

          if (!inventoryItem) {
            errors.push(
              `Allocation at index ${i}: Inventory item not found or doesn't belong to your company`
            );
            continue;
          }

          // Check if sufficient quantity is available
          // Fix for the allocation endpoint - replace the calculation section

          // Calculate new quantities - ensure all values are properly converted to numbers
          const currentAvailable =
            parseFloat(inventoryItem.quantity_available) || 0;
          const quantityToAllocate = parseFloat(quantity_to_allocate);
          const newInventoryQuantity = currentAvailable - quantityToAllocate;

          const currentAllocatedQty =
            parseFloat(productionGroup.allocated_Qty) || 0;
          const newAllocatedQty = currentAllocatedQty + quantityToAllocate;

          // Calculate new blocked quantity - ensure proper number conversion
          const currentBlockedQty =
            parseFloat(inventoryItem.quantity_blocked) || 0;
          const newBlockedQty = currentBlockedQty + quantityToAllocate;

          // Update inventory quantity_available and quantity_blocked
          await Inventory.update(
            {
              quantity_available: newInventoryQuantity,
              quantity_blocked: newBlockedQty, // This will now be a proper number
              updated_by: req.user.id,
            },
            {
              where: { id: inventory_id },
              transaction,
            }
          );

          // Update production group allocated_Qty
          await ProductionGroup.update(
            {
              allocated_Qty: newAllocatedQty,
              updated_by: req.user.id,
            },
            {
              where: { id: production_group_id },
              transaction,
            }
          );

          // Record the allocation in AllocationHistory
          await AllocationHistory.create(
            {
              company_id: req.user.company_id,
              inventory_id: inventory_id,
              group_id: production_group_id,
              allocated_Qty: quantityToAllocate, // Use the parsed number
              status: "active",
              created_by: req.user.id,
              updated_by: req.user.id,
            },
            { transaction }
          );

          allocationResults.push({
            index: i,
            production_group_id,
            inventory_id,
            quantity_allocated: quantityToAllocate, // Use parsed number
            inventory_remaining: newInventoryQuantity,
            quantity_blocked: newBlockedQty, // This will now be a proper number
            total_allocated_qty: newAllocatedQty,
            status: "success",
            message: "Allocation completed successfully",
          });

          logger.info(
            `Successfully allocated ${quantity_to_allocate} units from inventory ${inventory_id} to production group ${production_group_id}. Available: ${currentAvailable} -> ${newInventoryQuantity}, Blocked: ${currentBlockedQty} -> ${newBlockedQty}`
          );
        } catch (allocationError) {
          console.error(
            `Error processing allocation at index ${i}:`,
            allocationError
          );
          logger.error(
            `Error processing allocation at index ${i}:`,
            allocationError
          );
          errors.push(`Allocation at index ${i}: ${allocationError.message}`);
        }
      }

      // If there are any errors, rollback the transaction
      if (errors.length > 0) {
        await transaction.rollback();
        return res.status(400).json({
          message: "Allocation failed due to errors",
          errors,
          successful_allocations: 0,
          failed_allocations: errors.length,
        });
      }

      // If all allocations were successful, commit the transaction
      await transaction.commit();

      res.status(200).json({
        message: `Successfully processed ${allocationResults.length} allocations`,
        data: allocationResults,
        summary: {
          total_processed: allocationResults.length,
          successful: allocationResults.length,
          failed: 0,
        },
      });
    } catch (error) {
      // Rollback transaction on any unexpected error
      await transaction.rollback();
      console.error("Error processing raw material allocations:", error);
      logger.error("Error processing raw material allocations:", error);
      res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  }
);
// PATCH API to deallocate raw materials (reverse allocation)
v1Router.patch(
  "/production-group/deallocate",
  authenticateJWT,
  async (req, res) => {
    const { deallocations } = req.body;

    // Validate input
    if (
      !deallocations ||
      !Array.isArray(deallocations) ||
      deallocations.length === 0
    ) {
      return res.status(400).json({
        message: "deallocations array is required and must not be empty",
      });
    }

    // Start a database transaction
    const transaction = await sequelize.transaction();

    try {
      const deallocationResults = [];
      const errors = [];

      for (let i = 0; i < deallocations.length; i++) {
        const deallocation = deallocations[i];
        const { production_group_id, inventory_id, quantity_to_deallocate } =
          deallocation;

        try {
          // Validate required fields
          if (
            !production_group_id ||
            !inventory_id ||
            !quantity_to_deallocate
          ) {
            errors.push(
              `Deallocation at index ${i}: production_group_id, inventory_id, and quantity_to_deallocate are required`
            );
            continue;
          }

          // Validate quantity is positive
          if (quantity_to_deallocate <= 0) {
            errors.push(
              `Deallocation at index ${i}: quantity_to_deallocate must be greater than 0`
            );
            continue;
          }

          // Find the production group
          const productionGroup = await ProductionGroup.findOne({
            where: {
              id: production_group_id,
              company_id: req.user.company_id,
            },
            transaction,
          });

          if (!productionGroup) {
            errors.push(
              `Deallocation at index ${i}: Production group not found or doesn't belong to your company`
            );
            continue;
          }

          // Find the inventory item with lock to prevent race conditions
          const inventoryItem = await Inventory.findOne({
            where: {
              id: inventory_id,
              company_id: req.user.company_id,
            },
            lock: transaction.LOCK.UPDATE, // Add pessimistic lock
            transaction,
          });

          if (!inventoryItem) {
            errors.push(
              `Deallocation at index ${i}: Inventory item not found or doesn't belong to your company`
            );
            continue;
          }

          // Log current values for debugging
          console.log(`Before deallocation - Inventory ${inventory_id}:`, {
            current_available: inventoryItem.quantity_available,
            current_blocked: inventoryItem.quantity_blocked,
            quantity_to_deallocate: quantity_to_deallocate,
          });

          // Check allocation history to verify if this quantity was actually allocated
          const allocationRecord = await AllocationHistory.findOne({
            where: {
              company_id: req.user.company_id,
              inventory_id: inventory_id,
              group_id: production_group_id,
              status: "active", // Only consider active allocations
            },
            order: [["created_at", "DESC"]], // Get the most recent allocation
            transaction,
          });

          if (!allocationRecord) {
            errors.push(
              `Deallocation at index ${i}: No active allocation found for this inventory item and production group`
            );
            continue;
          }

          // Check if sufficient quantity is allocated to deallocate
          const currentAllocatedQty = productionGroup.allocated_Qty || 0;
          if (currentAllocatedQty < quantity_to_deallocate) {
            errors.push(
              `Deallocation at index ${i}: Insufficient allocated quantity. Currently allocated: ${currentAllocatedQty}, Requested to deallocate: ${quantity_to_deallocate}`
            );
            continue;
          }

          // Check if sufficient quantity is blocked to deallocate
          const currentBlockedQty = inventoryItem.quantity_blocked || 0;
          if (currentBlockedQty < quantity_to_deallocate) {
            errors.push(
              `Deallocation at index ${i}: Insufficient blocked quantity. Currently blocked: ${currentBlockedQty}, Requested to deallocate: ${quantity_to_deallocate}`
            );
            continue;
          }

          // Calculate new quantities
          const currentAvailable =
            parseFloat(inventoryItem.quantity_available) || 0;
          const deallocateQty = parseFloat(quantity_to_deallocate);
          const newInventoryQuantity = currentAvailable + deallocateQty;
          const newAllocatedQty = currentAllocatedQty - deallocateQty;
          const newBlockedQty = currentBlockedQty - deallocateQty;

          // Update inventory quantity_available and quantity_blocked (add back to available, reduce from blocked)
          const [inventoryUpdateCount] = await Inventory.update(
            {
              quantity_available: newInventoryQuantity,
              quantity_blocked: newBlockedQty,
              updated_by: req.user.id,
              updated_at: new Date(), // Explicitly set updated_at
            },
            {
              where: {
                id: inventory_id,
                company_id: req.user.company_id, // Extra safety check
              },
              transaction,
            }
          );

          // Verify inventory update was successful
          if (inventoryUpdateCount === 0) {
            throw new Error(`Failed to update inventory item ${inventory_id}`);
          }

          // Verify the update by fetching the updated record
          const updatedInventory = await Inventory.findOne({
            where: { id: inventory_id },
            attributes: ["id", "quantity_available", "quantity_blocked"],
            transaction,
          });

          console.log(`After inventory update - Inventory ${inventory_id}:`, {
            new_available: updatedInventory.quantity_available,
            expected_available: newInventoryQuantity,
            new_blocked: updatedInventory.quantity_blocked,
            expected_blocked: newBlockedQty,
          });

          // Update production group allocated_Qty (subtract the deallocated quantity)
          const [productionGroupUpdateCount] = await ProductionGroup.update(
            {
              allocated_Qty: newAllocatedQty,
              updated_by: req.user.id,
              updated_at: new Date(),
            },
            {
              where: {
                id: production_group_id,
                company_id: req.user.company_id,
              },
              transaction,
            }
          );

          // Verify production group update was successful
          if (productionGroupUpdateCount === 0) {
            throw new Error(
              `Failed to update production group ${production_group_id}`
            );
          }

          // Record the deallocation in AllocationHistory with negative quantity
          await AllocationHistory.create(
            {
              company_id: req.user.company_id,
              inventory_id: inventory_id,
              group_id: production_group_id,
              allocated_Qty: -deallocateQty, // Negative to indicate deallocation
              status: "inactive", // Use inactive status to indicate deallocation
              created_by: req.user.id,
              updated_by: req.user.id,
              created_at: new Date(),
              updated_at: new Date(),
            },
            { transaction }
          );

          deallocationResults.push({
            index: i,
            production_group_id,
            inventory_id,
            quantity_deallocated: deallocateQty,
            inventory_available_before: currentAvailable,
            inventory_available_after: newInventoryQuantity,
            inventory_blocked_before: currentBlockedQty,
            inventory_blocked_after: newBlockedQty,
            remaining_allocated_qty: newAllocatedQty,
            status: "success",
            message: "Deallocation completed successfully",
          });

          logger.info(
            `Successfully deallocated ${deallocateQty} units from production group ${production_group_id} back to inventory ${inventory_id}. Available: ${currentAvailable} -> ${newInventoryQuantity}, Blocked: ${currentBlockedQty} -> ${newBlockedQty}`
          );
        } catch (deallocationError) {
          console.error(
            `Error processing deallocation at index ${i}:`,
            deallocationError
          );
          logger.error(
            `Error processing deallocation at index ${i}:`,
            deallocationError
          );
          errors.push(
            `Deallocation at index ${i}: ${deallocationError.message}`
          );
        }
      }

      // If there are any errors, rollback the transaction
      if (errors.length > 0) {
        await transaction.rollback();
        return res.status(400).json({
          message: "Deallocation failed due to errors",
          errors,
          successful_deallocations: 0,
          failed_deallocations: errors.length,
        });
      }

      // If all deallocations were successful, commit the transaction
      await transaction.commit();

      res.status(200).json({
        message: `Successfully processed ${deallocationResults.length} deallocations`,
        data: deallocationResults,
        summary: {
          total_processed: deallocationResults.length,
          successful: deallocationResults.length,
          failed: 0,
        },
      });
    } catch (error) {
      // Rollback transaction on any unexpected error
      await transaction.rollback();
      console.error("Error processing raw material deallocations:", error);
      logger.error("Error processing raw material deallocations:", error);
      res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  }
);

// GET API to view allocation details for a production group
v1Router.get(
  "/production-group/:id/allocations",
  authenticateJWT,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Find the production group with its details
      const productionGroup = await ProductionGroup.findOne({
        where: {
          id: id,
          company_id: req.user.company_id,
        },
        attributes: [
          "id",
          "group_name",
          "group_Qty",
          "allocated_Qty",
          "status",
          "created_at",
          "updated_at",
        ],
      });

      if (!productionGroup) {
        return res.status(404).json({
          message:
            "Production group not found or doesn't belong to your company",
        });
      }

      // Get allocation history for this production group
      const allocationHistory = await AllocationHistory.findAll({
        where: {
          group_id: id,
          company_id: req.user.company_id,
        },
        include: [
          {
            model: Inventory,
            attributes: ["id", "inventory_generate_id","quantity_available", "quantity_blocked"],
          },
        ],
        order: [["created_at", "DESC"]],
        limit: 50,
      });

      res.status(200).json({
        message: "Production group allocation details retrieved successfully",
        data: {
          production_group: productionGroup,
          allocation_status: {
            required_qty: productionGroup.group_Qty || 0,
            allocated_qty: productionGroup.allocated_Qty || 0,
            remaining_to_allocate: Math.max(
              0,
              (productionGroup.group_Qty || 0) -
                (productionGroup.allocated_Qty || 0)
            ),
            allocation_percentage:
              productionGroup.group_Qty > 0
                ? Math.round(
                    ((productionGroup.allocated_Qty || 0) /
                      productionGroup.group_Qty) *
                      100
                  )
                : 0,
          },
          allocation_history: allocationHistory,
        },
      });
    } catch (error) {
      logger.error(
        "Error fetching production group allocation details:",
        error
      );
      res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  }
);
v1Router.get(
  "/allocation-history/inventory/:inventory_id",
  authenticateJWT,
  async (req, res) => {
    try {
      const { inventory_id } = req.params;

      // First, get the inventory data
      const inventoryItem = await Inventory.findOne({
        where: {
          id: inventory_id,
          company_id: req.user.company_id,
        },
        attributes: [
          "id",
          "item_code",
          "quantity_available",
          "quantity_blocked",
          "created_at",
          "updated_at"
        ]
      });

      if (!inventoryItem) {
        return res.status(404).json({
          message: "Inventory item not found or doesn't belong to your company"
        });
      }

      // Get allocation history for this specific inventory
      const allocationHistory = await AllocationHistory.findAll({
        where: {
          inventory_id: inventory_id,
          company_id: req.user.company_id,
        },
        include: [
          {
            model: ProductionGroup,
            attributes: ["id", "group_name", "group_Qty", "status"],
            required: false
          }
        ],
        order: [["created_at", "DESC"]],
      });

      if (allocationHistory.length === 0) {
        return res.status(200).json({
          message: "No allocation history found for this inventory",
          data: {
            inventory: inventoryItem,
            group_allocations: [],
            total_allocated: 0
          },
          count: 0
        });
      }

      // Group by group_id and sum allocated_Qty
      const groupedAllocations = {};
      let totalAllocated = 0;

      allocationHistory.forEach(record => {
        const groupId = record.group_id;
        const allocatedQty = parseFloat(record.allocated_Qty) || 0;
        
        if (!groupedAllocations[groupId]) {
          groupedAllocations[groupId] = {
            group_id: groupId,
            group_name: record.ProductionGroup ? record.ProductionGroup.group_name : null,
            group_qty: record.ProductionGroup ? parseFloat(record.ProductionGroup.group_Qty) || 0 : 0,
            group_status: record.ProductionGroup ? record.ProductionGroup.status : null,
            net_allocated_qty: 0,
            allocation_records: [],
            last_allocation_date: record.created_at
          };
        }

        // Sum up the allocated quantities (positive for allocations, negative for deallocations)
        groupedAllocations[groupId].net_allocated_qty += allocatedQty;
        
        // Add individual record to allocation_records array
        groupedAllocations[groupId].allocation_records.push({
          id: record.id,
          allocated_qty: allocatedQty,
          status: record.status,
          created_at: record.created_at,
          created_by: record.created_by
        });

        // Update last allocation date if this record is more recent
        if (new Date(record.created_at) > new Date(groupedAllocations[groupId].last_allocation_date)) {
          groupedAllocations[groupId].last_allocation_date = record.created_at;
        }
      });

      // Convert to array and calculate total allocated
      const groupAllocations = Object.values(groupedAllocations).map(group => {
        // Only count positive net allocations for total
        if (group.net_allocated_qty > 0) {
          totalAllocated += group.net_allocated_qty;
        }
        
        return {
          ...group,
          net_allocated_qty: parseFloat(group.net_allocated_qty.toFixed(2)) // Round to 2 decimal places
        };
      });

      // Sort by net_allocated_qty descending (most allocated first)
      groupAllocations.sort((a, b) => b.net_allocated_qty - a.net_allocated_qty);

      res.status(200).json({
        message: "Allocation history retrieved successfully",
        data: {
          inventory: {
            ...inventoryItem.toJSON(),
            quantity_available: parseFloat(inventoryItem.quantity_available) || 0,
            quantity_blocked: parseFloat(inventoryItem.quantity_blocked) || 0,
            // total_quantity: parseFloat(inventoryItem.total_quantity) || 0
          },
          group_allocations: groupAllocations,
          summary: {
            total_groups: groupAllocations.length,
            total_allocated: parseFloat(totalAllocated.toFixed(2)),
            total_records: allocationHistory.length
          }
        },
        count: allocationHistory.length
      });
    } catch (error) {
      console.error("Error fetching allocation history:", error);
      logger.error("Error fetching allocation history:", error);
      res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  }
);

// v1Router.patch("/production-group/batch/temporary-status", authenticateJWT, async (req, res) => {
//   const { groupIds, temporary_status } = req.body;

//   if (!Array.isArray(groupIds) || groupIds.length === 0) {
//     return res.status(400).json({ message: "groupIds must be a non-empty array" });
//   }
//   if (typeof temporary_status === 'undefined') {
//     return res.status(400).json({ message: "temporary_status is required" });
//   }

//   try {
//     const [updatedCount] = await ProductionGroup.update(
//       { temporary_status },
//       {
//         where: {
//           id: groupIds,
//           company_id: req.user.company_id,
//         },
//       }
//     );
//     if (updatedCount === 0) {
//       return res.status(404).json({ message: "No production groups updated. Check groupIds and permissions." });
//     }
//     res.json({ message: "temporary_status updated for groups", groupIds, temporary_status, updated_count: updatedCount });
//   } catch (error) {
//     logger.error("Error batch updating temporary_status:", error);
//     res.status(500).json({ message: "Internal Server Error", error: error.message });
//   }
// });



// ✅ Health Check Endpoint


app.get("/health", (req, res) => {
  res.json({
    status: "Service is running",
    timestamp: new Date(),
  });
});

// Use Version 1 Router
app.use("/api/production", v1Router);
// await db.sequelize.sync();
const PORT = 3029;
app.listen(process.env.PORT_PRODUCTION, "0.0.0.0", () => {
  console.log(
    `Production Service running on port ${process.env.PORT_PRODUCTION}`
  );
});


