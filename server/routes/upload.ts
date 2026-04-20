import { Router } from 'express';
import multer from 'multer';
import { minioClient, MINIO_BUCKET, MINIO_PUBLIC_BASE } from '../minioClient.js';
import { requireAuth } from '../auth/middleware.js';
import path from 'path';
import crypto from 'crypto';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', requireAuth, upload.single('foto'), async (req, res) => {
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

    const publicUrl = `${MINIO_PUBLIC_BASE}/${MINIO_BUCKET}/${filename}`;

    res.json({ url: publicUrl });
  } catch (err: any) {
    console.error('Erro no upload para MinIO:', err);
    // Retorna o erro específico para ajudar no diagnóstico
    const msg = err.message || 'Erro ao processar upload.';
    res.status(500).json({ error: `MinIO Error: ${msg}` });
  }
});

export default router;
