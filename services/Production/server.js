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

// POST create new work order
v1Router.post("/production-group", authenticateJWT, async (req, res) => {
  const groupDetailsArray = req.body;

  // Validate that we received an array
  if (!Array.isArray(groupDetailsArray) || groupDetailsArray.length === 0) {
    return res.status(400).json({ message: "Invalid input data - expected array of group objects" });
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
        });

        // Process group_value array to update work_order status
        if (groupDetails.group_value && Array.isArray(groupDetails.group_value)) {
          console.log(`Processing group_value array for group ${i}:`, groupDetails.group_value);
          
          for (const item of groupDetails.group_value) {
            const { work_order_id, layer_id } = item;
            console.log(`Processing item - work_order_id: ${work_order_id}, layer_id: ${layer_id}`);

            if (work_order_id && layer_id) {
              // Find work order by id
              const workOrder = await WorkOrder.findByPk(work_order_id);
              console.log(`Found work order:`, workOrder ? 'Yes' : 'No');

              if (workOrder && workOrder.work_order_sku_values) {
                console.log("Original work_order_sku_values:", workOrder.work_order_sku_values);
                console.log("Type of work_order_sku_values:", typeof workOrder.work_order_sku_values);
                
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
                  console.log(`Looking for layer_id: ${layer_id} in array of ${skuValues.length} items`);
                  
                  let updated = false;
                  const updatedSkuValues = skuValues.map((layer, index) => {
                    console.log(`Processing layer ${index}:`, {
                      layer_id: layer.layer_id,
                      layer_status: layer.layer_status,
                      matches_target: layer.layer_id === layer_id,
                      is_ungrouped: layer.layer_status === "ungrouped"
                    });
                    
                    // Important: Make sure layer_id comparison uses correct data types
                    // Convert both to numbers for comparison to avoid type mismatch
                    const layerIdNum = Number(layer.layer_id);
                    const targetLayerIdNum = Number(layer_id);
                    
                    if (layerIdNum === targetLayerIdNum && layer.layer_status === "ungrouped") {
                      updated = true;
                      console.log(`✅ Updating layer_id ${layer_id} from 'ungrouped' to 'grouped'`);
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
                        returning: true // This will help us see if the update actually happened
                      }
                    );
                    
                    console.log("Update result:", updateResult);
                    
                    logger.info(
                      `Successfully updated layer_id ${layer_id} to 'grouped' status in work_order_id ${work_order_id}`
                    );
                  } else {
                    console.log(`❌ No update needed for layer_id ${layer_id} in work_order_id ${work_order_id}`);
                    
                    // Let's see what layers we actually have
                    console.log("Available layers:", skuValues.map(l => ({
                      layer_id: l.layer_id,
                      layer_status: l.layer_status,
                      type_of_layer_id: typeof l.layer_id
                    })));
                    
                    logger.warn(
                      `No update needed for layer_id ${layer_id} in work_order_id ${work_order_id} - layer not found or already grouped`
                    );
                  }
                } else {
                  console.log("❌ work_order_sku_values is not an array:", typeof skuValues);
                  logger.error(
                    `work_order_sku_values is not an array for work_order_id ${work_order_id}`
                  );
                }
              } else {
                console.log(`❌ Work order not found or missing work_order_sku_values for work_order_id: ${work_order_id}`);
                logger.warn(
                  `Work order not found or missing work_order_sku_values for work_order_id: ${work_order_id}`
                );
              }
            } else {
              console.log(`❌ Missing work_order_id or layer_id in group_value item:`, item);
              logger.warn(
                `Missing work_order_id or layer_id in group_value item:`,
                item
              );
            }
          }
        }

        createdGroups.push(newProductionGroup);
        console.log(`✅ Successfully created group ${i}: ${groupDetails.group_name}`);

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
      data: createdGroups
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

// PATCH API to ungroup layers (set layer_status back to "ungrouped")
v1Router.patch(
  "/production-group/ungroup",
  authenticateJWT,
  async (req, res) => {
    const { work_order_layers } = req.body;

    // Validate input
    if (!work_order_layers || !Array.isArray(work_order_layers)) {
      return res.status(400).json({
        message: "work_order_layers array is required",
      });
    }

    try {
      const updateResults = [];

      for (const item of work_order_layers) {
        const { work_order_id, layer_id } = item;
        console.log(`Processing ungroup - work_order_id: ${work_order_id}, layer_id: ${layer_id}`);

        if (!work_order_id || !layer_id) {
          updateResults.push({
            work_order_id,
            layer_id,
            status: "failed",
            message: "work_order_id and layer_id are required",
          });
          continue;
        }

        // Find work order by id
        const workOrder = await WorkOrder.findByPk(work_order_id);
        console.log(`Found work order:`, workOrder ? 'Yes' : 'No');

        if (!workOrder || !workOrder.work_order_sku_values) {
          updateResults.push({
            work_order_id,
            layer_id,
            status: "failed",
            message: "Work order not found or missing sku_values",
          });
          continue;
        }

        console.log("Original work_order_sku_values:", workOrder.work_order_sku_values);
        console.log("Type of work_order_sku_values:", typeof workOrder.work_order_sku_values);

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
            updateResults.push({
              work_order_id,
              layer_id,
              status: "failed",
              message: "Error parsing work order sku values",
            });
            continue;
          }
        }

        // Update status for matching layer_id
        if (Array.isArray(skuValues)) {
          console.log(`Looking for layer_id: ${layer_id} in array of ${skuValues.length} items`);
          
          let updated = false;
          const updatedSkuValues = skuValues.map((layer, index) => {
            console.log(`Processing layer ${index}:`, {
              layer_id: layer.layer_id,
              layer_status: layer.layer_status,
              matches_target: layer.layer_id === layer_id,
              is_grouped: layer.layer_status === "grouped"
            });

            // Important: Make sure layer_id comparison uses correct data types
            // Convert both to numbers for comparison to avoid type mismatch
            const layerIdNum = Number(layer.layer_id);
            const targetLayerIdNum = Number(layer_id);

            if (layerIdNum === targetLayerIdNum && layer.layer_status === "grouped") {
              updated = true;
              console.log(`✅ Updating layer_id ${layer_id} from 'grouped' to 'ungrouped'`);
              return { ...layer, layer_status: "ungrouped" };
            }
            return layer;
          });

          console.log(`Update needed: ${updated}`);

          // Update work order if any changes were made
          if (updated) {
            console.log("Updated sku values:", updatedSkuValues);
            
            // Store as JavaScript object/array - Sequelize will handle JSON serialization
            // This matches the POST endpoint approach
            const finalSkuValues = updatedSkuValues;

            console.log("Final sku values to save:", finalSkuValues);

            const updateResult = await WorkOrder.update(
              {
                work_order_sku_values: finalSkuValues,
                updated_by: req.user.id,
              },
              { 
                where: { id: work_order_id },
                returning: true
              }
            );

            console.log("Update result:", updateResult);

            updateResults.push({
              work_order_id,
              layer_id,
              status: "success",
              message: "Layer status updated to ungrouped",
            });

            logger.info(
              `Successfully updated layer_id ${layer_id} to 'ungrouped' status in work_order_id ${work_order_id}`
            );
          } else {
            console.log(`❌ No update needed for layer_id ${layer_id} in work_order_id ${work_order_id}`);
            
            // Let's see what layers we actually have
            console.log("Available layers:", skuValues.map(l => ({
              layer_id: l.layer_id,
              layer_status: l.layer_status,
              type_of_layer_id: typeof l.layer_id
            })));

            updateResults.push({
              work_order_id,
              layer_id,
              status: "skipped",
              message: "Layer not found or already ungrouped",
            });
          }
        } else {
          console.log("❌ work_order_sku_values is not an array:", typeof skuValues);
          updateResults.push({
            work_order_id,
            layer_id,
            status: "failed",
            message: "Invalid sku_values format",
          });
        }
      }

      // Check if any updates were successful
      const successCount = updateResults.filter(
        (result) => result.status === "success"
      ).length;
      const failedCount = updateResults.filter(
        (result) => result.status === "failed"
      ).length;

      res.status(200).json({
        message: `Ungroup operation completed. ${successCount} successful, ${failedCount} failed.`,
        results: updateResults,
        summary: {
          total: updateResults.length,
          successful: successCount,
          failed: failedCount,
          skipped: updateResults.filter((result) => result.status === "skipped")
            .length,
        },
      });
    } catch (error) {
      console.error("Error ungrouping layers:", error);
      logger.error("Error ungrouping layers:", error);
      res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  }
);

v1Router.get("/production-group", authenticateJWT, async (req, res) => {
  try {
    const { include_work_orders = "false" } = req.query;

    // Get all production groups for the company
    const productionGroups = await ProductionGroup.findAll({
      where: {
        company_id: req.user.company_id,
      },
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

        // Include only layer details if requested
        if (include_work_orders === "true" && Array.isArray(groupValue)) {
          const layerDetails = await Promise.all(
            groupValue.map(async (item) => {
              const { work_order_id, layer_id, sales_order_id } = item;

              try {
                // Only fetch work_order_sku_values to extract layer details
                const workOrder = await WorkOrder.findByPk(work_order_id, {
                  attributes: ["id", "work_order_sku_values"],
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
                    layer_id,
                    sales_order_id,
                    layer_found: false,
                    error: "Layer not found in work order",
                  };
                }

                return {
                  work_order_id,
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

// allocation -------------------------

// // PATCH API to allocate raw materials
// v1Router.patch("/production-group/allocate", authenticateJWT, async (req, res) => {
//   const { allocations } = req.body;

//   // Validate input
//   if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
//     return res.status(400).json({
//       message: "allocations array is required and must not be empty",
//     });
//   }

//   // Start a database transaction
//   const transaction = await sequelize.transaction();

//   try {
//     const allocationResults = [];
//     const errors = [];

//     for (let i = 0; i < allocations.length; i++) {
//       const allocation = allocations[i];
//       const { production_group_id, inventory_id, quantity_to_allocate } = allocation;

//       try {
//         // Validate required fields for this allocation
//         if (!production_group_id || !inventory_id || !quantity_to_allocate) {
//           errors.push(`Allocation at index ${i}: production_group_id, inventory_id, and quantity_to_allocate are required`);
//           continue;
//         }

//         // Validate quantity is positive
//         if (quantity_to_allocate <= 0) {
//           errors.push(`Allocation at index ${i}: quantity_to_allocate must be greater than 0`);
//           continue;
//         }

//         // Find the production group
//         const productionGroup = await ProductionGroup.findOne({
//           where: {
//             id: production_group_id,
//             company_id: req.user.company_id
//           },
//           transaction
//         });

//         if (!productionGroup) {
//           errors.push(`Allocation at index ${i}: Production group not found or doesn't belong to your company`);
//           continue;
//         }

//         // Find the inventory item
//         const inventoryItem = await Inventory.findOne({
//           where: {
//             id: inventory_id,
//             company_id: req.user.company_id
//           },
//           transaction
//         });

//         if (!inventoryItem) {
//           errors.push(`Allocation at index ${i}: Inventory item not found or doesn't belong to your company`);
//           continue;
//         }

//         // Check if sufficient quantity is available
//         const currentAvailable = inventoryItem.quantity_available || 0;
//         if (currentAvailable < quantity_to_allocate) {
//           errors.push(`Allocation at index ${i}: Insufficient inventory. Available: ${currentAvailable}, Requested: ${quantity_to_allocate}`);
//           continue;
//         }

//         // Calculate new quantities
//         const newInventoryQuantity = currentAvailable - quantity_to_allocate;
//         const currentAllocatedQty = productionGroup.allocated_Qty || 0;
//         const newAllocatedQty = currentAllocatedQty + quantity_to_allocate;

//         // Update inventory quantity_available
//         await Inventory.update(
//           {
//             quantity_available: newInventoryQuantity,
//             updated_by: req.user.id,
//           },
//           {
//             where: { id: inventory_id },
//             transaction
//           }
//         );

//         // Update production group allocated_Qty
//         await ProductionGroup.update(
//           {
//             allocated_Qty: newAllocatedQty,
//             updated_by: req.user.id,
//           },
//           {
//             where: { id: production_group_id },
//             transaction
//           }
//         );

//         allocationResults.push({
//           index: i,
//           production_group_id,
//           inventory_id,
//           quantity_allocated: quantity_to_allocate,
//           inventory_remaining: newInventoryQuantity,
//           total_allocated_qty: newAllocatedQty,
//           status: "success",
//           message: "Allocation completed successfully"
//         });

//         logger.info(
//           `Successfully allocated ${quantity_to_allocate} units from inventory ${inventory_id} to production group ${production_group_id}`
//         );

//       } catch (allocationError) {
//         console.error(`Error processing allocation at index ${i}:`, allocationError);
//         logger.error(`Error processing allocation at index ${i}:`, allocationError);
//         errors.push(`Allocation at index ${i}: ${allocationError.message}`);
//       }
//     }

//     // If there are any errors, rollback the transaction
//     if (errors.length > 0) {
//       await transaction.rollback();
//       return res.status(400).json({
//         message: "Allocation failed due to errors",
//         errors,
//         successful_allocations: 0,
//         failed_allocations: errors.length
//       });
//     }

//     // If all allocations were successful, commit the transaction
//     await transaction.commit();

//     res.status(200).json({
//       message: `Successfully processed ${allocationResults.length} allocations`,
//       data: allocationResults,
//       summary: {
//         total_processed: allocationResults.length,
//         successful: allocationResults.length,
//         failed: 0
//       }
//     });

//   } catch (error) {
//     // Rollback transaction on any unexpected error
//     await transaction.rollback();
//     console.error("Error processing raw material allocations:", error);
//     logger.error("Error processing raw material allocations:", error);
//     res.status(500).json({
//       message: "Internal Server Error",
//       error: error.message,
//     });
//   }
// });

// // GET API to view allocation details for a production group
// v1Router.get("/production-group/:id/allocations", authenticateJWT, async (req, res) => {
//   try {
//     const { id } = req.params;

//     // Find the production group with its details
//     const productionGroup = await ProductionGroup.findOne({
//       where: {
//         id: id,
//         company_id: req.user.company_id
//       },
//       attributes: [
//         "id",
//         "group_name",
//         "group_Qty",
//         "allocated_Qty",
//         "status",
//         "created_at",
//         "updated_at"
//       ]
//     });

//     if (!productionGroup) {
//       return res.status(404).json({
//         message: "Production group not found or doesn't belong to your company"
//       });
//     }

//     res.status(200).json({
//       message: "Production group allocation details retrieved successfully",
//       data: {
//         production_group: productionGroup,
//         allocation_status: {
//           required_qty: productionGroup.group_Qty || 0,
//           allocated_qty: productionGroup.allocated_Qty || 0,
//           remaining_to_allocate: Math.max(0, (productionGroup.group_Qty || 0) - (productionGroup.allocated_Qty || 0)),
//           allocation_percentage: productionGroup.group_Qty > 0 
//             ? Math.round(((productionGroup.allocated_Qty || 0) / productionGroup.group_Qty) * 100)
//             : 0
//         }
//       }
//     });

//   } catch (error) {
//     logger.error("Error fetching production group allocation details:", error);
//     res.status(500).json({
//       message: "Internal Server Error",
//       error: error.message,
//     });
//   }
// });

// // PATCH API to deallocate raw materials (reverse allocation)
// v1Router.patch("/production-group/deallocate", authenticateJWT, async (req, res) => {
//   const { deallocations } = req.body;

//   // Validate input
//   if (!deallocations || !Array.isArray(deallocations) || deallocations.length === 0) {
//     return res.status(400).json({
//       message: "deallocations array is required and must not be empty",
//     });
//   }

//   // Start a database transaction
//   const transaction = await sequelize.transaction();

//   try {
//     const deallocationResults = [];
//     const errors = [];

//     for (let i = 0; i < deallocations.length; i++) {
//       const deallocation = deallocations[i];
//       const { production_group_id, inventory_id, quantity_to_deallocate } = deallocation;

//       try {
//         // Validate required fields
//         if (!production_group_id || !inventory_id || !quantity_to_deallocate) {
//           errors.push(`Deallocation at index ${i}: production_group_id, inventory_id, and quantity_to_deallocate are required`);
//           continue;
//         }

//         // Validate quantity is positive
//         if (quantity_to_deallocate <= 0) {
//           errors.push(`Deallocation at index ${i}: quantity_to_deallocate must be greater than 0`);
//           continue;
//         }

//         // Find the production group
//         const productionGroup = await ProductionGroup.findOne({
//           where: {
//             id: production_group_id,
//             company_id: req.user.company_id
//           },
//           transaction
//         });

//         if (!productionGroup) {
//           errors.push(`Deallocation at index ${i}: Production group not found or doesn't belong to your company`);
//           continue;
//         }

//         // Find the inventory item
//         const inventoryItem = await Inventory.findOne({
//           where: {
//             id: inventory_id,
//             company_id: req.user.company_id
//           },
//           transaction
//         });

//         if (!inventoryItem) {
//           errors.push(`Deallocation at index ${i}: Inventory item not found or doesn't belong to your company`);
//           continue;
//         }

//         // Check if sufficient quantity is allocated to deallocate
//         const currentAllocatedQty = productionGroup.allocated_Qty || 0;
//         if (currentAllocatedQty < quantity_to_deallocate) {
//           errors.push(`Deallocation at index ${i}: Insufficient allocated quantity. Currently allocated: ${currentAllocatedQty}, Requested to deallocate: ${quantity_to_deallocate}`);
//           continue;
//         }

//         // Calculate new quantities
//         const currentAvailable = inventoryItem.quantity_available || 0;
//         const newInventoryQuantity = currentAvailable + quantity_to_deallocate;
//         const newAllocatedQty = currentAllocatedQty - quantity_to_deallocate;

//         // Update inventory quantity_available (add back the deallocated quantity)
//         await Inventory.update(
//           {
//             quantity_available: newInventoryQuantity,
//             updated_by: req.user.id,
//           },
//           {
//             where: { id: inventory_id },
//             transaction
//           }
//         );

//         // Update production group allocated_Qty (subtract the deallocated quantity)
//         await ProductionGroup.update(
//           {
//             allocated_Qty: newAllocatedQty,
//             updated_by: req.user.id,
//           },
//           {
//             where: { id: production_group_id },
//             transaction
//           }
//         );

//         deallocationResults.push({
//           index: i,
//           production_group_id,
//           inventory_id,
//           quantity_deallocated: quantity_to_deallocate,
//           inventory_available: newInventoryQuantity,
//           remaining_allocated_qty: newAllocatedQty,
//           status: "success",
//           message: "Deallocation completed successfully"
//         });

//         logger.info(
//           `Successfully deallocated ${quantity_to_deallocate} units from production group ${production_group_id} back to inventory ${inventory_id}`
//         );

//       } catch (deallocationError) {
//         console.error(`Error processing deallocation at index ${i}:`, deallocationError);
//         logger.error(`Error processing deallocation at index ${i}:`, deallocationError);
//         errors.push(`Deallocation at index ${i}: ${deallocationError.message}`);
//       }
//     }

//     // If there are any errors, rollback the transaction
//     if (errors.length > 0) {
//       await transaction.rollback();
//       return res.status(400).json({
//         message: "Deallocation failed due to errors",
//         errors,
//         successful_deallocations: 0,
//         failed_deallocations: errors.length
//       });
//     }

//     // If all deallocations were successful, commit the transaction
//     await transaction.commit();

//     res.status(200).json({
//       message: `Successfully processed ${deallocationResults.length} deallocations`,
//       data: deallocationResults,
//       summary: {
//         total_processed: deallocationResults.length,
//         successful: deallocationResults.length,
//         failed: 0
//       }
//     });

//   } catch (error) {
//     // Rollback transaction on any unexpected error
//     await transaction.rollback();
//     console.error("Error processing raw material deallocations:", error);
//     logger.error("Error processing raw material deallocations:", error);
//     res.status(500).json({
//       message: "Internal Server Error",
//       error: error.message,
//     });
//   }
// });




// PATCH API to allocate raw materials
v1Router.patch("/production-group/allocate", authenticateJWT, async (req, res) => {
  const { allocations } = req.body;

  // Validate input
  if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
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
      const { production_group_id, inventory_id, quantity_to_allocate } = allocation;

      try {
        // Validate required fields for this allocation
        if (!production_group_id || !inventory_id || !quantity_to_allocate) {
          errors.push(`Allocation at index ${i}: production_group_id, inventory_id, and quantity_to_allocate are required`);
          continue;
        }

        // Validate quantity is positive
        if (quantity_to_allocate <= 0) {
          errors.push(`Allocation at index ${i}: quantity_to_allocate must be greater than 0`);
          continue;
        }

        // Find the production group
        const productionGroup = await ProductionGroup.findOne({
          where: {
            id: production_group_id,
            company_id: req.user.company_id
          },
          transaction
        });

        if (!productionGroup) {
          errors.push(`Allocation at index ${i}: Production group not found or doesn't belong to your company`);
          continue;
        }

        // Find the inventory item
        const inventoryItem = await Inventory.findOne({
          where: {
            id: inventory_id,
            company_id: req.user.company_id
          },
          transaction
        });

        if (!inventoryItem) {
          errors.push(`Allocation at index ${i}: Inventory item not found or doesn't belong to your company`);
          continue;
        }

        // Check if sufficient quantity is available
        const currentAvailable = inventoryItem.quantity_available || 0;
        if (currentAvailable < quantity_to_allocate) {
          errors.push(`Allocation at index ${i}: Insufficient inventory. Available: ${currentAvailable}, Requested: ${quantity_to_allocate}`);
          continue;
        }

        // Calculate new quantities
        const newInventoryQuantity = currentAvailable - quantity_to_allocate;
        const currentAllocatedQty = productionGroup.allocated_Qty || 0;
        const newAllocatedQty = currentAllocatedQty + quantity_to_allocate;

        // Update inventory quantity_available
        await Inventory.update(
          {
            quantity_available: newInventoryQuantity,
            updated_by: req.user.id,
          },
          {
            where: { id: inventory_id },
            transaction
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
            transaction
          }
        );

        // Record the allocation in AllocationHistory
        await AllocationHistory.create(
          {
            company_id: req.user.company_id,
            inventory_id: inventory_id,
            group_id: production_group_id,
            allocated_Qty: quantity_to_allocate,
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
          quantity_allocated: quantity_to_allocate,
          inventory_remaining: newInventoryQuantity,
          total_allocated_qty: newAllocatedQty,
          status: "success",
          message: "Allocation completed successfully"
        });

        logger.info(
          `Successfully allocated ${quantity_to_allocate} units from inventory ${inventory_id} to production group ${production_group_id}`
        );

      } catch (allocationError) {
        console.error(`Error processing allocation at index ${i}:`, allocationError);
        logger.error(`Error processing allocation at index ${i}:`, allocationError);
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
        failed_allocations: errors.length
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
        failed: 0
      }
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
});

// GET API to view allocation details for a production group
v1Router.get("/production-group/:id/allocations", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    // Find the production group with its details
    const productionGroup = await ProductionGroup.findOne({
      where: {
        id: id,
        company_id: req.user.company_id
      },
      attributes: [
        "id",
        "group_name",
        "group_Qty",
        "allocated_Qty",
        "status",
        "created_at",
        "updated_at"
      ]
    });

    if (!productionGroup) {
      return res.status(404).json({
        message: "Production group not found or doesn't belong to your company"
      });
    }

    // Get allocation history for this production group
    const allocationHistory = await AllocationHistory.findAll({
      where: {
        group_id: id,
        company_id: req.user.company_id
      },
      include: [
        {
          model: Inventory,
          attributes: ["id", "item_name", "item_code"]
        }
      ],
      order: [["created_at", "DESC"]],
      limit: 50 // Limit to recent 50 records
    });

    res.status(200).json({
      message: "Production group allocation details retrieved successfully",
      data: {
        production_group: productionGroup,
        allocation_status: {
          required_qty: productionGroup.group_Qty || 0,
          allocated_qty: productionGroup.allocated_Qty || 0,
          remaining_to_allocate: Math.max(0, (productionGroup.group_Qty || 0) - (productionGroup.allocated_Qty || 0)),
          allocation_percentage: productionGroup.group_Qty > 0 
            ? Math.round(((productionGroup.allocated_Qty || 0) / productionGroup.group_Qty) * 100)
            : 0
        },
        allocation_history: allocationHistory
      }
    });

  } catch (error) {
    logger.error("Error fetching production group allocation details:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

// PATCH API to deallocate raw materials (reverse allocation)
v1Router.patch("/production-group/deallocate", authenticateJWT, async (req, res) => {
  const { deallocations } = req.body;

  // Validate input
  if (!deallocations || !Array.isArray(deallocations) || deallocations.length === 0) {
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
      const { production_group_id, inventory_id, quantity_to_deallocate } = deallocation;

      try {
        // Validate required fields
        if (!production_group_id || !inventory_id || !quantity_to_deallocate) {
          errors.push(`Deallocation at index ${i}: production_group_id, inventory_id, and quantity_to_deallocate are required`);
          continue;
        }

        // Validate quantity is positive
        if (quantity_to_deallocate <= 0) {
          errors.push(`Deallocation at index ${i}: quantity_to_deallocate must be greater than 0`);
          continue;
        }

        // Find the production group
        const productionGroup = await ProductionGroup.findOne({
          where: {
            id: production_group_id,
            company_id: req.user.company_id
          },
          transaction
        });

        if (!productionGroup) {
          errors.push(`Deallocation at index ${i}: Production group not found or doesn't belong to your company`);
          continue;
        }

        // Find the inventory item
        const inventoryItem = await Inventory.findOne({
          where: {
            id: inventory_id,
            company_id: req.user.company_id
          },
          transaction
        });

        if (!inventoryItem) {
          errors.push(`Deallocation at index ${i}: Inventory item not found or doesn't belong to your company`);
          continue;
        }

        // Check if sufficient quantity is allocated to deallocate
        const currentAllocatedQty = productionGroup.allocated_Qty || 0;
        if (currentAllocatedQty < quantity_to_deallocate) {
          errors.push(`Deallocation at index ${i}: Insufficient allocated quantity. Currently allocated: ${currentAllocatedQty}, Requested to deallocate: ${quantity_to_deallocate}`);
          continue;
        }

        // Calculate new quantities
        const currentAvailable = inventoryItem.quantity_available || 0;
        const newInventoryQuantity = currentAvailable + quantity_to_deallocate;
        const newAllocatedQty = currentAllocatedQty - quantity_to_deallocate;

        // Update inventory quantity_available (add back the deallocated quantity)
        await Inventory.update(
          {
            quantity_available: newInventoryQuantity,
            updated_by: req.user.id,
          },
          {
            where: { id: inventory_id },
            transaction
          }
        );

        // Update production group allocated_Qty (subtract the deallocated quantity)
        await ProductionGroup.update(
          {
            allocated_Qty: newAllocatedQty,
            updated_by: req.user.id,
          },
          {
            where: { id: production_group_id },
            transaction
          }
        );

        // Record the deallocation in AllocationHistory with negative quantity
        await AllocationHistory.create(
          {
            company_id: req.user.company_id,
            inventory_id: inventory_id,
            group_id: production_group_id,
            allocated_Qty: -quantity_to_deallocate, // Negative to indicate deallocation
            status: "inactive", // Use inactive status to indicate deallocation
            created_by: req.user.id,
            updated_by: req.user.id,
          },
          { transaction }
        );

        deallocationResults.push({
          index: i,
          production_group_id,
          inventory_id,
          quantity_deallocated: quantity_to_deallocate,
          inventory_available: newInventoryQuantity,
          remaining_allocated_qty: newAllocatedQty,
          status: "success",
          message: "Deallocation completed successfully"
        });

        logger.info(
          `Successfully deallocated ${quantity_to_deallocate} units from production group ${production_group_id} back to inventory ${inventory_id}`
        );

      } catch (deallocationError) {
        console.error(`Error processing deallocation at index ${i}:`, deallocationError);
        logger.error(`Error processing deallocation at index ${i}:`, deallocationError);
        errors.push(`Deallocation at index ${i}: ${deallocationError.message}`);
      }
    }

    // If there are any errors, rollback the transaction
    if (errors.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Deallocation failed due to errors",
        errors,
        successful_deallocations: 0,
        failed_deallocations: errors.length
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
        failed: 0
      }
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
});

// Optional: GET API to view allocation history for a company
v1Router.get("/allocation-history", authenticateJWT, async (req, res) => {
  try {
    const { page = 1, limit = 20, group_id, inventory_id } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const whereClause = {
      company_id: req.user.company_id
    };

    if (group_id) {
      whereClause.group_id = group_id;
    }

    if (inventory_id) {
      whereClause.inventory_id = inventory_id;
    }

    const { count, rows: allocationHistory } = await AllocationHistory.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: ProductionGroup,
          attributes: ["id", "group_name"]
        },
        {
          model: Inventory,
          attributes: ["id", "item_name", "item_code"]
        },
        {
          model: User,
          as: "creator_group",
          attributes: ["id", "name", "email"]
        }
      ],
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: offset
    });

    res.status(200).json({
      message: "Allocation history retrieved successfully",
      data: allocationHistory,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(count / parseInt(limit)),
        total_records: count,
        records_per_page: parseInt(limit)
      }
    });

  } catch (error) {
    logger.error("Error fetching allocation history:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});


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
