import express from 'express'
import { findMatchingEvents } from '../service/yandex-afisha-service'
import { createBill } from '../service/billing-service'
import asyncHandler from 'express-async-handler'
import { getAllExhibitions } from '../service/web-service';


export const apiRouter = express.Router()
    .use(express.json())
    .post('/find-matching', asyncHandler(async (req, res) => {
        await res.send(await findMatchingEvents(req.body))
    }))
    .post('/payment/create', asyncHandler(async (req, res) => {
        await res.send(await createBill(req.body, () => 100.0))
    }))
    .get('/exhibitions', asyncHandler(async (req, res) => {
        await res.send(await getAllExhibitions(req.body))
    }))