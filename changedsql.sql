CREATE TABLE `clients` (
  `client_id` int(11) NOT NULL,
  `customer_type` enum('Business','Individual') NOT NULL,
  `salutation` varchar(50) DEFAULT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `display_name` varchar(255) NOT NULL,
  `company_name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `work_phone` varchar(20) DEFAULT NULL,
  `mobile` varchar(20) DEFAULT NULL,
  `PAN` varchar(50) DEFAULT NULL,
  `currency` varchar(50) DEFAULT 'INR Indian Rupee',
  `opening_balance` decimal(10,2) DEFAULT NULL,
  `payment_terms` varchar(255) DEFAULT NULL,
  `enable_portal` tinyint(1) DEFAULT 0,
  `portal_language` varchar(50) DEFAULT 'English',
  `documents` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`documents`)),
  `website_url` varchar(255) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `designation` varchar(100) DEFAULT NULL,
  `twitter` varchar(255) DEFAULT NULL,
  `skype` varchar(255) DEFAULT NULL,
  `facebook` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `clients`
--

INSERT INTO `clients` (`client_id`, `customer_type`, `salutation`, `first_name`, `last_name`, `display_name`, `company_name`, `email`, `work_phone`, `mobile`, `PAN`, `currency`, `opening_balance`, `payment_terms`, `enable_portal`, `portal_language`, `documents`, `website_url`, `department`, `designation`, `twitter`, `skype`, `facebook`, `created_at`, `updated_at`) VALUES
(1, 'Business', 'Mr.', 'John', 'Doe', 'John Doe Enterprises', 'Doe Inc.', 'johndoe@example.com', '123-456-7890', '987-654-3210', 'ABCDE1234F', 'USD', 5000.00, 'Due on Receipt', 1, 'English', NULL, 'https://www.johndoe.com', 'Finance', 'Manager', 'https://twitter.com/johndoe', 'john_doe_skype', 'https://facebook.com/johndoe', '2025-03-02 08:38:39', '2025-03-02 08:38:39'),
(2, 'Individual', 'Ms.', 'Emma', 'Watson', 'Emma Watson', NULL, 'emma@example.com', '987-123-4567', '987-321-6540', 'PQRS9876G', 'INR Indian Rupee', 10000.00, 'Net 30', 0, 'English', NULL, 'https://www.emmawatson.com', 'Marketing', 'Executive', 'https://twitter.com/emmawatson', 'emma_watson_skype', 'https://facebook.com/emmawatson', '2025-03-02 08:38:39', '2025-03-02 08:38:39'),
(5, 'Business', 'Mr.', 'Columbus ', 'D', 'Columbus D', 'Zivora Enterprises', 'zivora@gmail.com', '123-456-7890', '987-654-3210', 'ABCDE1234F', 'INR Indian Rupee', 5000.00, 'Due on Receipt', 1, 'English', '[{\"file_name\":\"contract.pdf\",\"file_url\":\"https://example.com/files/contract.pdf\"}]', 'https://www.pazl.com', 'Finance', 'Manager', 'https://twitter.com/johndoe', 'john.doe123', 'https://facebook.com/johndoe', '2025-03-02 09:00:52', '2025-03-02 09:00:52');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `clients`
--
ALTER TABLE `clients`
  ADD PRIMARY KEY (`client_id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `clients`
--
ALTER TABLE `clients`
  MODIFY `client_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;
COMMIT;


ALTER TABLE `clients` ADD `company_id` INT(11) NOT NULL AFTER `client_id`;


