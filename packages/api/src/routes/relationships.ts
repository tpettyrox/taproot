import { Router, Request, Response } from 'express';
import * as relService from '../services/relationshipService';

const router = Router();

router.post('/parent', async (req: Request, res: Response) => {
  try {
    const { parentId, childId } = req.body as { parentId: string; childId: string };
    if (!parentId || !childId) {
      return res.status(400).json({ error: 'parentId and childId are required' });
    }
    await relService.addParentChild(parentId, childId);
    res.status(201).json({ parentId, childId });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.delete('/parent', async (req: Request, res: Response) => {
  try {
    const { parentId, childId } = req.body as { parentId: string; childId: string };
    if (!parentId || !childId) {
      return res.status(400).json({ error: 'parentId and childId are required' });
    }
    await relService.removeParentChild(parentId, childId);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/spouse', async (req: Request, res: Response) => {
  try {
    const { person1Id, person2Id } = req.body as { person1Id: string; person2Id: string };
    if (!person1Id || !person2Id) {
      return res.status(400).json({ error: 'person1Id and person2Id are required' });
    }
    const result = await relService.addSpouse(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.put('/spouse', async (req: Request, res: Response) => {
  try {
    const { person1Id, person2Id, ...update } = req.body as {
      person1Id: string;
      person2Id: string;
    };
    if (!person1Id || !person2Id) {
      return res.status(400).json({ error: 'person1Id and person2Id are required' });
    }
    await relService.updateSpouse(person1Id, person2Id, update);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/spouse', async (req: Request, res: Response) => {
  try {
    const { person1Id, person2Id } = req.body as { person1Id: string; person2Id: string };
    if (!person1Id || !person2Id) {
      return res.status(400).json({ error: 'person1Id and person2Id are required' });
    }
    await relService.removeSpouse(person1Id, person2Id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
