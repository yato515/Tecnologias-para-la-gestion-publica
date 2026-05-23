import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Importación de Middlewares (Legacy)
import { verifyToken } from './middleware/auth.middleware.js';
import { loadDocuments } from './middleware/loadDocuments.middleware.js';

// Importación de Rutas Legacy
import authRoutes from './routes/auth.routes.js';
import userRoutes    from './routes/users.routes.js';
import gestorRoutes  from './routes/gestores.js';
import tramiteRoutesLegacy from './routes/tramites.js';
import reportRoutes  from './routes/reportes.js';

// Importación de Nuevas Rutas (Clean Architecture)
import solicitudesRoutes from './routes/solicitudes.routes.js';
import tramitesRoutes from './routes/tramites.routes.js';
import expedientesRoutes from './routes/expedientes.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares Globales
app.use(cors());
app.use(express.json());

// ==========================================
// RUTAS CLEAN ARCHITECTURE (Nuevas)
// ==========================================
// Interceptamos rutas específicas generadas con Clean Architecture
app.use('/api', solicitudesRoutes); 
app.use('/api/tramites/catalogo', tramitesRoutes);
app.use('/api/expedientes', expedientesRoutes);

// ==========================================
// RUTAS LEGACY (Existentes)
// ==========================================
app.use('/api/auth',     authRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/gestores', gestorRoutes);
// Las rutas legacy de trámites quedan protegidas
app.use('/api/tramites', verifyToken, loadDocuments, tramiteRoutesLegacy);
app.use('/api/reportes', reportRoutes);

// Healthcheck Route
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'online', 
    message: 'API CivicFlow funcionando correctamente (Migrando a Clean Architecture)' 
  });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
