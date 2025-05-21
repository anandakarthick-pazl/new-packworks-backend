import express, { json, Router } from "express";
import cors from "cors";
import { Op } from "sequelize";
import db from "../../common/models/index.js"; 
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
const Taxes = db.Taxes;
const Client = db.Client;
const User =db.User;

dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();


// Get taxes
/**
 * @swagger
 * /taxes:
 *   get:
 *     summary: Get a list of active taxes
 *     tags:
 *       - Taxes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search keyword to filter taxes by name
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of records per page
 *     responses:
 *       200:
 *         description: Taxes fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Taxes Fetched Successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tax'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: internal server error
 */
    
v1Router.get('/',authenticateJWT, async (req,res)=>{
    try{
        const { search="" , page = 1, limit = 10 }=req.query;
        const pageNumber = Math.max(1,parseInt(page)) || 1;
        const limitNumber =Math.max(10,parseInt(limit)) || 10;
        const offset = (pageNumber-1) * limitNumber;

        let whereCondition = { status : "active" };
        if(search.trim() !== ""){
            whereCondition={
                ...whereCondition,
                name: { [Op.like] : `%${search}` }
            }
        }
        const taxes=await Taxes.findAll({
            where : whereCondition,
            limit : limitNumber,
            offset
        })

        return res.status(200).json({
            success:true,
            message:"Taxes Fetched Successfully",
            data:taxes
         });

    }catch(error){
        console.error("Error fetching package : ",error);
        
        return res.status(200).json({
           success:false,
           message:"internel server error"           
        })
    }
});


//Create Taxes
/**
 * @swagger
 * /taxes/create:
 *   post:
 *     summary: Create a new tax
 *     tags:
 *       - Taxes
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tax_name
 *               - rate_percent
 *             properties:
 *               tax_name:
 *                 type: string
 *                 example: GST
 *               rate_percent:
 *                 type: number
 *                 example: 18
 *     responses:
 *       201:
 *         description: Tax created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 Success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Taxes Created Successfully
 *                 data:
 *                   $ref: '#/components/schemas/Tax'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */

v1Router.post("/create",authenticateJWT,async(req,res)=>{
    const transaction = await sequelize.transaction();
    try{
        const {taxesData, ...rest } =req.body;
        
        const userId=req.user.id;
        rest.created_by = userId;
        rest.updated_by = userId;
        rest.company_id =req.user.company_id;

        const taxes = await Taxes.create( rest, {transaction} );
        await transaction.commit();

        return res.status(201).json({
            Success:true,
            message:"Taxes Created Successfully",
            data: taxes.toJSON(),
        })
    }catch(error){
        await transaction.rollback();
        console.error("Error creating Taxes : ",error);
        return res.status(500).json({ error:error.message,success:false })
        
    }
});

//edit
/**
 * @swagger
 * /taxes/edit/{tax_id}:
 *   get:
 *     summary: Get tax details by ID
 *     tags:
 *       - Taxes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tax_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the tax to retrieve
 *     responses:
 *       200:
 *         description: Tax data fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: taxes data fetched successfully
 *                 data:
 *                   $ref: '#/components/schemas/Tax'
 *       404:
 *         description: Tax not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Taxes not found
 *                 data:
 *                   type: string
 *                   example: null
 */

v1Router.get("/edit/:tax_id",authenticateJWT,async(req,res)=>{

    const { tax_id }= req.params;
    const taxes = await Taxes.findOne({
        where : { id : tax_id }
    });
    if(!taxes){
        return res.status(404).json({
            success:false,
            message:"Taxes not found",
            data : null
        })
    }
    return res.status(200).json({
        success:true,
        message:"taxes data fetched successfully",
        data: {...taxes.toJSON()}
    })
})


//update
/**
 * @swagger
 * /taxes/update/{tax_id}:
 *   put:
 *     summary: Update tax details by ID
 *     tags:
 *       - Taxes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tax_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the tax to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tax_name:
 *                 type: string
 *               rate_percent:
 *                 type: number
 *             example:
 *               tax_name: GST
 *               rate_percent: 18
 *     responses:
 *       200:
 *         description: Tax updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Taxes updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Tax'
 *       400:
 *         description: Invalid tax ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: invalid tax id
 *       404:
 *         description: Tax not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Taxes Not Found
 *       500:
 *         description: Internal server error
 */

v1Router.put("/update/:tax_id",authenticateJWT,async(req,res)=>{
    const transaction = await sequelize.transaction();
    try{
        const tax_id=parseInt(req.params.tax_id);
        const {...rest}=req.body;
        if (isNaN(tax_id)) {
           return res.status(400).json({message:"invalid tax id"});
        }

        const existingTaxes= await Taxes.findByPk(tax_id,{transaction});
        if(!existingTaxes){
            return res.status(404).json({success:false,message:"Taxes Not Found"})
        }
        rest.updated_by=req.user.id;
        rest.company_id=req.user.company_id;
        rest.updated_at=new Date();

        await Taxes.update(rest,{ where:{id:tax_id}, transaction });

        const updatedTaxes= await Taxes.findByPk( tax_id, {transaction} );

        await transaction.commit();



        return res.status(200).json({
            success:true,
            message:"Taxes updated successfully",
            data:updatedTaxes
        })

    }catch(error){
        console.error("Taxes updated Error", error);
        return res.status(500).json({success:false,message:error.message});
        
    }
})


//delete
/**
 * @swagger
 * /taxes/delete/{id}:
 *   delete:
 *     summary: Soft delete a tax record by ID
 *     tags:
 *       - Taxes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Tax ID to be deleted
 *     responses:
 *       200:
 *         description: Taxes deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Taxes deleted successfully
 *                 data:
 *                   type: array
 *                   example: []
 *       400:
 *         description: Invalid tax ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Invalid tax
 *       404:
 *         description: Tax not found
 *       500:
 *         description: Internal server error
 */

v1Router.delete("/delete/:id", authenticateJWT, async (req, res) => {
    try {
      const taxId = parseInt(req.params.id);
      const userId = req.user.id;
  
      if (isNaN(taxId)) {
        return res.status(400).json({ success: false, message: "Invalid tax" });
      }
  
      const taxes = await Taxes.findOne({ where: { id: taxId } });
  
      if (!taxes) {
        return res.status(404).json({
          success: false,
          message: "Taxes not found"
        });
      }
  
      await Taxes.update(
        {
          status: "inactive",
          deleted_at: new Date(),
          updated_by: userId,
        },
        {
          where: { id: taxId },
        }
      );
  
      return res.status(200).json({
        success: true,
        message: "Taxes deleted successfully",
        data: [],
      });
    } catch (error) {
      console.error("Taxes delete error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Taxes deletion error",
      });
    }
});
  


app.use("/api/taxes", v1Router);
await db.sequelize.sync();
const PORT = 3021;
app.listen(process.env.PORT_TAXES, '0.0.0.0', () => {
  console.log(`Taxes Service running on port ${process.env.PORT_TAXES}`);
});

