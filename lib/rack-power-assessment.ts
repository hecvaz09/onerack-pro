import {analyzeFeeds,type FeedInputs} from './feed-power.ts';
import {feedRack,readFeedInputs,type FeedEquipment} from './feed-rack.ts';
import {designPowerAnalysis} from './outlet-planning-checks.ts';

// Saved reviews and exports share the same model, calculations and distinction
// between an outlet design and the verification still needed for installation.
export function rackPowerAssessment(equipment:FeedEquipment[],inputs:FeedInputs){
  const model=feedRack(equipment,inputs);
  const strict=analyzeFeeds(model.supplies,model.loads,model.cords,inputs.headroomPercent);
  return {inputs,...model,strict,design:designPowerAnalysis(strict)};
}

// Always provide equipment when reading legacy settings so every consumer uses
// the same migration. Once feedPower exists, it is authoritative over px3Power.
export function savedRackPowerAssessment(equipment:FeedEquipment[],configuration:unknown){
  return rackPowerAssessment(equipment,readFeedInputs(configuration,equipment));
}
