import { Router, Request, Response } from 'express';
import { createAndRunExtractionJob, getJob } from '../services/extractionService';

const router = Router();

router.post('/:mediaId', async (req: Request, res: Response) => {
  try {
    const jobId = await createAndRunExtractionJob(req.params.mediaId);
    res.status(201).json({ jobId, status: 'pending' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:jobId', async (req: Request, res: Response) => {
  try {
    const job = await getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
