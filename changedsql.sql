DROP TABLE IF EXISTS `user_auths`;

CREATE TABLE `user_auths` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
    `password` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
    `remember_token` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `two_factor_secret` text COLLATE utf8mb4_unicode_ci,
    `two_factor_recovery_codes` text COLLATE utf8mb4_unicode_ci,
    `two_factor_confirmed` tinyint(1) NOT NULL DEFAULT '0',
    `two_factor_email_confirmed` tinyint(1) NOT NULL DEFAULT '0',
    `two_fa_verify_via` enum('email', 'google_authenticator', 'both') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `two_factor_code` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'when authenticator is email',
    `two_factor_expires_at` datetime DEFAULT NULL,
    `email_verified_at` datetime DEFAULT NULL,
    `email_verification_code` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `email_code_expires_at` datetime DEFAULT NULL,
    `created_at` timestamp NULL DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `user_auths_email_unique` (`email`),
    KEY `user_auths_email_index` (`email`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

DELIMITER $ $ CREATE PROCEDURE `ProcedureInsertCompanyAndUsers` (
    IN `p_name` varchar(100),
    IN `p_email` varchar(191),
    IN `p_currency` varchar(10),
    IN `p_timezone` varchar(50),
    IN `p_language` varchar(50),
    IN `p_address` varchar(255),
    IN `p_phone` varchar(255),
    IN `p_website` varchar(255),
    IN `p_logo` varchar(255),
    IN `p_accountName` varchar(100),
    IN `p_accountEmail` varchar(191),
    IN `p_defaultPassword` varchar(100),
    OUT `p_newCompanyId` int
) BEGIN DECLARE newCompanyId INT;

DECLARE newUserAuthId INT;

-- ✅ Step 1: Insert into the `companies` table
INSERT INTO
    companies (
        company_name,
        company_email,
        currency_id,
        timezone,
        created_at,
        updated_at,
        address,
        company_phone,
        website,
        logo
    )
VALUES
    (
        p_name,
        p_email,
        p_currency,
        p_timezone,
        NOW(),
        NOW(),
        p_address,
        p_phone,
        p_website,
        p_logo
    );

SET
    newCompanyId = LAST_INSERT_ID();

-- Get the new company ID
SET
    p_newCompanyId = newCompanyId;

-- Set output parameter
-- ✅ Step 2: Insert into `user_auth` (authentication details)
INSERT INTO
    user_auths (email, password, created_at, updated_at)
VALUES
    (p_accountEmail, p_defaultPassword, NOW(), NOW());

SET
    newUserAuthId = LAST_INSERT_ID();

-- Get the new user_auth ID
-- ✅ Step 3: Insert into `users` table
INSERT INTO
    users (
        name,
        email,
        company_id,
        user_auth_id,
        created_at,
        updated_at
    )
VALUES
    (
        p_accountName,
        p_accountEmail,
        newCompanyId,
        newUserAuthId,
        NOW(),
        NOW()
    );

END $ $ DELIMITER;

DELIMITER $ $ CREATE PROCEDURE CopyEmailNotificationSettings(IN p_newCompanyId INT) BEGIN -- Copy email notification settings from Company ID = 1
INSERT INTO email_notification_settings (company_id,slug,setting_name,send_email,send_slack,send_push,created_at,updated_at)
SELECT
    p_newCompanyId,
    slug,
    setting_name,
    send_email,
    send_slack,
    send_push,
    NOW(),
    NOW()
FROM
    email_notification_settings
WHERE
    company_id = 1;

END $ $ DELIMITER;

DELIMITER $ $ CREATE PROCEDURE ProcedureCopyModuleSettings(IN p_newCompanyId INT) BEGIN -- Copy module settings from Company ID = 1
INSERT INTO
    module_settings (company_id, module_name, status,type, created_at, updated_at,is_allowed)
SELECT
    p_newCompanyId,
    module_name,
    status,
    type,
    NOW(),
    NOW(),
    is_allowed
FROM
    module_settings
WHERE
    company_id = 1;

END $ $ DELIMITER;

DELIMITER $ $ CREATE PROCEDURE ProcedureCopyRolesAndPermissions(IN p_newCompanyId INT) BEGIN DECLARE newRoleId INT;

DECLARE oldRoleId INT;

-- Copy roles from Company ID = 1
DECLARE role_cursor CURSOR FOR
SELECT
    id
FROM
    roles
WHERE
    company_id = 1;

DECLARE CONTINUE HANDLER FOR NOT FOUND
SET
    oldRoleId = NULL;

OPEN role_cursor;

role_loop: LOOP FETCH role_cursor INTO oldRoleId;

IF oldRoleId IS NULL THEN LEAVE role_loop;

END IF;

-- Insert the new role
INSERT INTO
    roles (
        company_id,
        name,
        display_name,
        description,
        created_at,
        updated_at
    )
SELECT
    p_newCompanyId,
    name,
    display_name,
    description,
    NOW(),
    NOW()
FROM
    roles
WHERE
    id = oldRoleId;

SET
    newRoleId = LAST_INSERT_ID();

-- Get new role ID
-- Copy role permissions
INSERT INTO
    permission_role (permission_id, role_id, permission_type_id)
SELECT
    permission_id,
    newRoleId,
    permission_type_id
FROM
    permission_role
WHERE
    role_id = oldRoleId;

END LOOP;

CLOSE role_cursor;

END $ $ DELIMITER;

ALTER TABLE
    `companies` CHANGE `before_days` `before_days` int NOT NULL DEFAULT '0'
AFTER
    `header_color`,
    CHANGE `after_days` `after_days` int NOT NULL DEFAULT '0'
AFTER
    `before_days`;

ALTER TABLE
    `companies` CHANGE `allow_client_signup` `allow_client_signup` tinyint(1) NOT NULL DEFAULT '1'
AFTER
    `session_driver`,
    CHANGE `admin_client_signup_approval` `admin_client_signup_approval` tinyint(1) NOT NULL DEFAULT '1'
AFTER
    `allow_client_signup`;

DROP TABLE IF EXISTS `currencies`;

CREATE TABLE `currencies` (
    `id` int unsigned NOT NULL AUTO_INCREMENT,
    `company_id` int unsigned DEFAULT NULL,
    `currency_name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
    `currency_symbol` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `currency_code` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
    `exchange_rate` double DEFAULT NULL,
    `is_cryptocurrency` enum('yes', 'no') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'no',
    `usd_price` double DEFAULT NULL,
    `created_at` timestamp NULL DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL,
    `no_of_decimal` int unsigned NOT NULL DEFAULT '2',
    `thousand_separator` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `decimal_separator` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `currency_position` enum(
        'left',
        'right',
        'left_with_space',
        'right_with_space'
    ) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'left',
    PRIMARY KEY (`id`),
    KEY `currencies_company_id_foreign` (`company_id`),
    CONSTRAINT `currencies_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

INSERT INTO
    `currencies` (
        `id`,
        `company_id`,
        `currency_name`,
        `currency_symbol`,
        `currency_code`,
        `exchange_rate`,
        `is_cryptocurrency`,
        `usd_price`,
        `created_at`,
        `updated_at`,
        `no_of_decimal`,
        `thousand_separator`,
        `decimal_separator`,
        `currency_position`
    )
VALUES
    (
        1,
        1,
        'Dollars',
        '$',
        'USD',
        1,
        'no',
        NULL,
        NULL,
        NULL,
        2,
        ',',
        '.',
        'left'
    ),
    (
        2,
        1,
        'Pounds',
        '£',
        'GBP',
        1,
        'no',
        NULL,
        NULL,
        NULL,
        2,
        ',',
        '.',
        'left'
    ),
    (
        3,
        1,
        'Euros',
        '€',
        'EUR',
        1,
        'no',
        NULL,
        NULL,
        NULL,
        2,
        ',',
        '.',
        'left'
    ),
    (
        4,
        1,
        'Rupee',
        '₹',
        'INR',
        1,
        'no',
        NULL,
        NULL,
        NULL,
        2,
        ',',
        '.',
        'left'
    );

DELIMITER $ $ DROP PROCEDURE IF EXISTS `CopyCurrency` $ $ CREATE PROCEDURE `CopyCurrency`(IN newCompanyId INT) BEGIN -- Insert records by copying data from company_id = 1
INSERT INTO
    currencies (
        company_id,
        currency_name,
        currency_symbol,
        currency_code,
        exchange_rate,
        is_cryptocurrency,
        usd_price,
        created_at,
        updated_at,
        no_of_decimal,
        thousand_separator,
        decimal_separator,
        currency_position
    )
SELECT
    newCompanyId,
    currency_name,
    currency_symbol,
    currency_code,
    exchange_rate,
    is_cryptocurrency,
    usd_price,
    NOW(),
    NOW(),
    no_of_decimal,
    thousand_separator,
    decimal_separator,
    currency_position
FROM
    currencies
WHERE
    company_id = 1;

END $ $ DELIMITER;

ALTER TABLE
    `users` CHANGE `dark_theme` `dark_theme` tinyint(1) NOT NULL DEFAULT '1'
AFTER
    `country_id`,
    CHANGE `rtl` `rtl` tinyint(1) NOT NULL DEFAULT '1'
AFTER
    `dark_theme`;


    DROP TABLE IF EXISTS `api_logs`;
CREATE TABLE `api_logs` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Primary key of the table',
  `userId` int DEFAULT NULL COMMENT 'Foreign key referencing the users table',
  `method` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'HTTP method of the API request',
  `url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'URL of the API request',
  `statusCode` int NOT NULL COMMENT 'HTTP status code of the API response',
  `requestBody` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci COMMENT 'Request body of the API request',
  `requestHeaders` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci COMMENT 'Header of the API request',
  `responseBody` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci COMMENT 'Response body of the API response',
  `errorMessage` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci COMMENT 'Error message if the API request failed',
  `stackTrace` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci COMMENT 'Stack trace if the API request failed',
  `duration` int DEFAULT NULL COMMENT 'Duration of the API request in milliseconds',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when the record was created',
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Timestamp when the record was last updated',
  PRIMARY KEY (`id`),
  KEY `api_logs_userId_idx` (`userId`),
  KEY `api_logs_statusCode_idx` (`statusCode`),
  KEY `api_logs_createdAt_idx` (`createdAt`),
  CONSTRAINT `api_logs_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Table containing logs of API requests and responses';
