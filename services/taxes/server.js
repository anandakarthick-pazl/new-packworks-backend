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
app.listen(PORT, () => {
  console.log(`Taxes Service running on port ${PORT}`);
});

