import { Router, Request, Response } from 'express';
import { getFullTree } from '../services/treeService';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const tree = await getFullTree();
    res.json(tree);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
