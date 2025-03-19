import Joi from "joi";
import { Op } from "sequelize";
import Client from "../models/client.model.js";
import User from "../models/user.model.js";
import Company from "../models/company.model.js";

export const validateClient = async (req, res, next) => {
    try {
        // Define validation schema for client data
        const clientDataSchema = Joi.object({
            company_id: Joi.number().integer().positive().allow(null),
            client_ref_id: Joi.string().required(),
            gst_status: Joi.boolean().default(true),
            gst_number: Joi.string().when('gst_status', {
                is: true,
                then: Joi.string().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).message('Invalid GST number format').required(),
                otherwise: Joi.string().allow(null, '')
            }),
            entity_type: Joi.string().valid("Client", "Vendor").default("Client"),
            customer_type: Joi.string().valid("Business", "Individual").required(),
            salutation: Joi.string().allow(null, ''),
            first_name: Joi.string().when('customer_type', {
                is: 'Individual',
                then: Joi.string().required(),
                otherwise: Joi.string().allow(null, '')
            }),
            last_name: Joi.string().when('customer_type', {
                is: 'Individual',
                then: Joi.string().required(),
                otherwise: Joi.string().allow(null, '')
            }),
            display_name: Joi.string().required(),
            company_name: Joi.string().when('customer_type', {
                is: 'Business',
                then: Joi.string().required(),
                otherwise: Joi.string().allow(null, '')
            }),
            email: Joi.string().email().required(),
            work_phone: Joi.string().allow(null, ''),
            mobile: Joi.string().allow(null, ''),
            PAN: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).message('Invalid PAN format').allow(null, ''),
            currency: Joi.string().default("INR Indian Rupee"),
            opening_balance: Joi.number().precision(2).allow(null),
            payment_terms: Joi.string().allow(null, ''),
            enable_portal: Joi.boolean().default(false),
            portal_language: Joi.string().default("English"),
            documents: Joi.object().allow(null),
            website_url: Joi.string().uri().allow(null, ''),
            department: Joi.string().allow(null, ''),
            designation: Joi.string().allow(null, ''),
            twitter: Joi.string().allow(null, ''),
            skype: Joi.string().allow(null, ''),
            facebook: Joi.string().allow(null, ''),
            status: Joi.string().valid("active", "inactive").default("active")
        });

        // Define schema for address
        const addressSchema = Joi.object({
            attention: Joi.string().allow(null, ''),
            country: Joi.string().required(),
            street1: Joi.string().required(),
            street2: Joi.string().allow(null, ''),
            city: Joi.string().required(),
            state: Joi.string().required(),
            pinCode: Joi.string().required(),
            phone: Joi.string().required(), // Allow any phone format initially
            faxNumber: Joi.string().allow(null, ''),
            status: Joi.string().valid("active", "inactive").default("active")
        });

        // Define the main schema with clientData and addresses as separate properties
        const mainSchema = Joi.object({
            clientData: clientDataSchema.required(),
            addresses: Joi.array().items(addressSchema).min(1).required().messages({
                'array.min': 'At least one address is required'
            })
        });

        // Validate request body
        const { error, value } = mainSchema.validate(req.body, { abortEarly: false });

        if (error) {
            return res.status(400).json({ message: "Validation error", errors: error.details });
        }

        const { clientData, addresses } = value;

        // Sanitize phone numbers
        if (clientData.work_phone) {
            clientData.work_phone = clientData.work_phone.replace(/\D/g, '');
        }
        
        if (clientData.mobile) {
            clientData.mobile = clientData.mobile.replace(/\D/g, '');
        }
        
        addresses.forEach(address => {
            if (address.phone) {
                address.phone = address.phone.replace(/\D/g, '');
            }
        });

        // Store sanitized data back in req.body
        req.body = { clientData, addresses };

        const clientId = req.params.client_id || null; // Get ID from request params (for update)

        // Check if email is unique
        if (clientId) {
            // Update scenario: Ensure email is unique excluding the current record
            const existingClient = await Client.findOne({
                where: { email: clientData.email, client_id: { [Op.ne]: clientId } }
            });

            if (existingClient) {
                return res.status(400).json({ message: "Email is already in use by another client." });
            }
        } else {
            // Insert scenario: Ensure email is unique
            const existingClient = await Client.findOne({ where: { email: clientData.email } });

            if (existingClient) {
                return res.status(400).json({ message: "Email is already in use. Please use a different email." });
            }
        }

        // Validate company_id exists if provided
        if (clientData.company_id) {
            const companyExists = await Company.findByPk(clientData.company_id);
            if (!companyExists) {
                return res.status(400).json({ message: "The specified company does not exist." });
            }
        }

        // If validation passes, proceed to next middleware/controller
        next();
    } catch (err) {
        console.error("Validation error:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

export const validateAddress = async (req, res, next) => {
    try {
        // Define validation schema for address
        const addressSchema = Joi.object({
            client_id: Joi.number().integer().positive().required(),
            attention: Joi.string().allow(null, ''),
            country: Joi.string().required(),
            street1: Joi.string().required(),
            street2: Joi.string().allow(null, ''),
            city: Joi.string().required(),
            state: Joi.string().required(),
            pinCode: Joi.string().required(),
            phone: Joi.string().required(),
            faxNumber: Joi.string().allow(null, ''),
            status: Joi.string().valid("active", "inactive").default("active")
        });

        // Validate request body
        const { error, value } = addressSchema.validate(req.body, { abortEarly: false });

        if (error) {
            return res.status(400).json({ message: "Validation error", errors: error.details });
        }

        // Sanitize phone number
        if (value.phone) {
            value.phone = value.phone.replace(/\D/g, '');
        }

        // Save sanitized data back to req.body
        req.body = value;

        // Check if client exists
        const clientExists = await Client.findByPk(value.client_id);
        if (!clientExists) {
            return res.status(400).json({ message: "The specified client does not exist." });
        }

        // If validation passes, proceed to next middleware/controller
        next();
    } catch (err) {
        console.error("Validation error:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};