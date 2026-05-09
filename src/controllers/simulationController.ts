import { Request, Response } from 'express';
import { simulationService } from '../services/simulationService';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response';
import { validateOrThrow } from '../validation';
import { SimulationRequestSchema, type SimulationRequest } from '../validation/simulation.schema';

export const runSimulation = catchAsync(async (req: Request, res: Response) => {
  // validateOrThrow calls schema.parse() which applies .default() transforms at runtime.
  // Cast through unknown to align with our hand-written SimulationRequest output type.
  const input = validateOrThrow(SimulationRequestSchema, req.body) as unknown as SimulationRequest;
  const result = await simulationService.simulate(req.workspace, input);
  sendSuccess(res, result, 200);
});
