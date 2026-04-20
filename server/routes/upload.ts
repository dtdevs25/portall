import { Router } from 'express';
import multer from 'multer';
import { minioClient, MINIO_BUCKET } from '../minioClient.js';
import { authenticateToken } from '../auth/middleware.js';
import path from 'path';
import crypto from 'crypto';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', authenticateToken, upload.single('foto'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const file = req.file;
    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `${crypto.randomUUID()}${ext}`;

    await minioClient.putObject(
      MINIO_BUCKET,
      filename,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype }
    );

    // Build the public URL
    const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
    const endpoint = process.env.MINIO_ENDPOINT || 'minio.ctdibrasil.com.br';
    const publicUrl = `${protocol}://${endpoint}/${MINIO_BUCKET}/${filename}`;

    res.json({ url: publicUrl });
  } catch (err: any) {
    console.error('Erro no upload para MinIO:', err);
    res.status(500).json({ error: 'Erro ao processar upload.' });
  }
});

export default router;
