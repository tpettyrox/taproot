import { Router, Request, Response } from 'express';
import * as personService from '../services/personService';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const persons = await personService.getAllPersons();
    res.json(persons);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const person = await personService.getPersonById(req.params.id);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    res.json(person);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName } = req.body as Record<string, string>;
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'firstName and lastName are required' });
    }
    const person = await personService.createPerson(req.body);
    res.status(201).json(person);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const person = await personService.updatePerson(req.params.id, req.body);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    res.json(person);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await personService.deletePerson(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Person not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
