import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import userRoutes    from './routes/users.routes.js';
import gestorRoutes  from './routes/gestores.js';
import tramiteRoutes from './routes/tramites.js';
import reportRoutes  from './routes/reportes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/users',    userRoutes);
app.use('/api/gestores', gestorRoutes);
app.use('/api/tramites', tramiteRoutes);
app.use('/api/reportes', reportRoutes);

app.get('/', (req, res) => {
  res.status(200).json({ status: 'online', message: 'API funcionando correctamente' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
