import { Router, Request, Response } from 'express';
import * as faceService from '../services/faceService';

const router = Router();

router.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const { status, personId } = req.query as { status?: string; personId?: string };
    const suggestions = await faceService.getSuggestions({ status, personId });
    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/:suggestionId/confirm', async (req: Request, res: Response) => {
  try {
    const { personId } = req.body as { personId?: string };
    if (!personId) return res.status(400).json({ error: 'personId is required' });
    await faceService.confirmSuggestion(req.params.suggestionId, personId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/:suggestionId/reject', async (req: Request, res: Response) => {
  try {
    await faceService.rejectSuggestion(req.params.suggestionId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
