import apiLog from '../models/apiLog.model.js';
import { sendEmail } from "../../common/helper/emailService.js";
import dotenv from 'dotenv';  // Use `require('dotenv').config()` for CommonJS syntax
dotenv.config();

export const logRequestResponse = async (req, res, next) => {
    const { method, url, body, headers, user } = req;
    const userId = user?.id || 1; // Provide a fallback userId
    const startTime = Date.now();
    var logId;
    var requestBody = JSON.stringify(body);
    try {
        const log = await apiLog.create({
            userId,
            method,
            url,
            requestBody: requestBody,
            responseBody: '',
            errorMessage: '',
            stackTrace: '',
            duration: 0,
            createdAt: new Date(),
            statusCode: 200,
            requestHeaders: JSON.stringify(headers),
        });
        logId = log.id;
    } catch (error) {
        console.error('Failed to log request:', error);
    }

    const originalSend = res.send;

    res.send = async function (data) {
        const duration = Date.now() - startTime;

        try {
            await apiLog.update(
                {
                    statusCode: res.statusCode,
                    responseBody: data.toString(),
                    duration,
                },
                { where: { id: logId } }
            );

            if (res.statusCode === 500) {
                await sendEmail(process.env.ERROR_EMAIL, `${process.env.APP_Name} Application Error Notification`, `An error occurred in the application:\n\nUser: ${userId}\nMethod: ${method}\nURL: ${url}\nResponse: ${data}`);
               
            }
        } catch (error) {
            console.error('Failed to update response log:', error);
        }

        originalSend.apply(res, arguments);
    };

    res.on('finish', async () => {
        if (res.statusCode >= 400 && res.statusCode !== 500) {
            const errorMessage = `Error with status code ${res.statusCode}`;
            const stackTrace = new Error().stack;

            try {
                await apiLog.update(
                    {
                        statusCode: res.statusCode,
                        errorMessage,
                        stackTrace,
                    },
                    { where: { id: logId } }
                );

                await sendEmail(process.env.ERROR_EMAIL, `${process.env.APP_Name} Application Error Notification`, `An error occurred in the application:\n\nUser: ${userId}\nMethod: ${method}\nURL: ${url}\nError: ${errorMessage}\nStack Trace:\n${stackTrace}`);
            } catch (error) {
                console.error('Failed to update error log or enqueue email:', error);
            }
        }
    });

    next();
};
