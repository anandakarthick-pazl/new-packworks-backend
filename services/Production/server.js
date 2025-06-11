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


v1Router.post("/production-group", authenticateJWT, async (req, res) => {
  const groupDetails = req.body;

  if (!groupDetails) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  // Validate required fields
  if (!groupDetails.group_name) {
    return res.status(400).json({ message: "Group name is required" });
  }

  try {
    // Create Production Group
    const newProductionGroup = await ProductionGroup.create({
      company_id: req.user.company_id,
      group_name: groupDetails.group_name,
      group_value: groupDetails.group_value || null,
      group_Qty: groupDetails.group_Qty || null,
      status: groupDetails.status || "active",
      created_by: req.user.id,
      updated_by: req.user.id,
    });

    // Process group_value array to update work_order status
    if (groupDetails.group_value && Array.isArray(groupDetails.group_value)) {
      console.log("Processing group_value array:", groupDetails.group_value);
      
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

    res.status(201).json({
      message: "Production Group created successfully",
      data: newProductionGroup,
    });
  } catch (error) {
    console.error("Error creating production group:", error);
    logger.error("Error creating production group:", error);
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
