-- Add column_mapping column to data_transfers table
ALTER TABLE data_transfers 
ADD COLUMN column_mapping TEXT NULL 
COMMENT 'JSON mapping of Excel columns to database fields';

-- Update status enum to include 'uploaded' status  
ALTER TABLE data_transfers 
MODIFY COLUMN status ENUM('uploaded', 'pending', 'processing', 'completed', 'failed') 
NOT NULL DEFAULT 'uploaded' 
COMMENT 'Current status of the data transfer process';
