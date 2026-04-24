import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as mediaService from '../services/mediaService';
import * as storage from '../services/storageService';
import { enqueueFaceDetection } from '../jobs/faceQueue';

const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB ?? '50', 10);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpe?g|png|webp|gif|pdf|doc[x]?|xls[x]?|txt)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

const router = Router();

router.post('/upload/:personId', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { type = 'photo', caption, date } = req.body as {
      type?: string;
      caption?: string;
      date?: string;
    };
    const mediaType = type === 'document' ? 'document' : 'photo';
    const record = await mediaService.saveMedia(req.params.personId, req.file, mediaType, caption, date);

    if (mediaType === 'photo') {
      enqueueFaceDetection(record.id);
    }

    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const record = await mediaService.getMediaRecord(req.params.id);
    if (!record) return res.status(404).json({ error: 'Media not found' });
    const stream = await storage.getReadStream(record.storageKey);
    res.setHeader('Content-Type', record.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id/thumbnail', async (req: Request, res: Response) => {
  try {
    const record = await mediaService.getMediaRecord(req.params.id);
    if (!record) return res.status(404).json({ error: 'Media not found' });

    try {
      const stream = await storage.getReadStream(storage.thumbKey(req.params.id));
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      stream.pipe(res);
    } catch {
      // No thumbnail — fall back to original
      const stream = await storage.getReadStream(record.storageKey);
      res.setHeader('Content-Type', record.mimeType);
      stream.pipe(res);
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.patch('/:id/caption', async (req: Request, res: Response) => {
  try {
    const { caption } = req.body as { caption: string };
    await mediaService.updateMediaCaption(req.params.id, caption ?? '');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await mediaService.deleteMedia(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Media not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
