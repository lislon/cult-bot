import express from 'express'
// const express = require('express');
const app = express()

app.get(`/api/parse`, function (req: any, res: any) {
    res.send(`Hello World!`)
})

app.get(`/`, function (req: any, res: any) {
    res.send(`Hello World!`)
 })
const port = 3333
app.listen(port, () => console.log(`App is listening on port ${port}!`))