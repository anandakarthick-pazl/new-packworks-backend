// common/services/s3Service.js
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import multerS3 from "multer-s3";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// Create S3 client instance
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Default file size limit in bytes (10MB)
const DEFAULT_FILE_SIZE_LIMIT = 10 * 1024 * 1024;

// Default allowed file types
const DEFAULT_FILE_TYPES = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;

/**
 * Creates a multer upload instance for S3
 * @param {Object} options - Configuration options
 * @param {string} options.folderPath - Path within the bucket (e.g., 'clients/documents')
 * @param {function} options.fileNameGenerator - Function to generate file name
 * @param {RegExp} options.allowedFileTypes - Regex of allowed file types
 * @param {number} options.fileSizeLimit - File size limit in bytes
 * @param {number} options.maxFiles - Maximum number of files
 * @returns {Object} multer upload instance
 */
export const createS3Upload = ({
  folderPath = 'uploads',
  fileNameGenerator = null,
  allowedFileTypes = DEFAULT_FILE_TYPES,
  fileSizeLimit = DEFAULT_FILE_SIZE_LIMIT,
  maxFiles = 10,
  fieldName = 'files',
} = {}) => {
  // Default file name generator
  const defaultFileNameGenerator = (req, file) => {
    return `${folderPath}/${Date.now()}-${file.originalname}`;
  };

  // Create multer upload instance
  return multer({
    storage: multerS3({
      s3,
      bucket: process.env.AWS_BUCKET_NAME,
      metadata: (req, file, cb) => {
        cb(null, { fieldName: file.fieldname });
      },
      key: (req, file, cb) => {
        const fileName = fileNameGenerator ? 
          fileNameGenerator(req, file) : 
          defaultFileNameGenerator(req, file);
        cb(null, fileName);
      },
    }),
    limits: { fileSize: fileSizeLimit },
    fileFilter: (req, file, cb) => {
      const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedFileTypes.test(file.mimetype);
      if (extname && mimetype) {
        return cb(null, true);
      } else {
        cb(new Error("Error: Invalid file type!"));
      }
    },
  }).array(fieldName, maxFiles);
};

/**
 * Deletes a file from S3
 * @param {string} key - S3 object key
 * @returns {Promise} Promise resolving to deletion result
 */
export const deleteS3File = async (key) => {
  try {
    return await s3.send(new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key
    }));
  } catch (error) {
    console.error("Error deleting file from S3:", error);
    throw error;
  }
};

/**
 * Formats uploaded file info for storage
 * @param {Object} file - Multer file object
 * @param {string} userId - ID of user uploading the file
 * @returns {Object} Formatted file info
 */
export const formatFileInfo = (file, userId) => {
  return {
    id: Date.now() + '-' + Math.random().toString(36).substring(2, 15),
    name: file.originalname,
    url: file.location,
    key: file.key,
    size: file.size,
    type: file.mimetype,
    uploaded_by: userId,
    uploaded_at: new Date()
  };
};

export default {
  s3,
  createS3Upload,
  deleteS3File,
  formatFileInfo
};