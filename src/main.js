/**
 * main.js
 * @author Ollie Husband
 */

import express from 'express';

const app = express();

app.use('/', (req, res) => {
	res.status(403).end();
});

app.listen(process.env.PORT || 3000);

console.log(`Running on: http://localhost:${process.env.PORT || 3000}`);