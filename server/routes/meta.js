import { Router } from 'express';
import { ROLES } from '../../pipeline/lib/taxonomy.js';

const LIVE = { active: true, isFresher: true };
const DAY_MS = 86_400_000;

const countBy = (field) => [{ $group: { _id: field, count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $project: { _id: 0, value: '$_id', count: 1 } }];

export function metaRouter(db) {
  const router = Router();
  const jobs = db.collection('jobs');

  // Latest pipeline run + live counts from the jobs collection.
  router.get('/meta', async (_req, res) => {
    const [run, total, internships, jobsCount, newLast24h] = await Promise.all([
      db.collection('runs').findOne({}, { sort: { generatedAt: -1 }, projection: { _id: 0 } }),
      jobs.countDocuments(LIVE),
      jobs.countDocuments({ ...LIVE, jobType: 'Internship' }),
      jobs.countDocuments({ ...LIVE, jobType: { $ne: 'Internship' } }),
      jobs.countDocuments({ ...LIVE, postedAt: { $gte: new Date(Date.now() - DAY_MS) } }),
    ]);
    if (!run) return res.status(404).json({ error: 'No pipeline run yet. Run `npm run pipeline` first.' });
    const sources = Array.isArray(run.sources) ? run.sources : [];
    res.json({
      ...run,
      sourceHealth: {
        total: sources.length,
        succeeded: sources.filter((source) => source.ok === true).length,
        failed: sources.filter((source) => source.ok === false).length,
      },
      live: { total, internships, jobs: jobsCount, newLast24h },
    });
  });

  // Unfiltered option counts for tabs, filter dropdowns and Insights.
  router.get('/facets', async (_req, res) => {
    const [facets] = await jobs
      .aggregate([
        { $match: LIVE },
        {
          $facet: {
            roles: countBy('$role'),
            cities: [{ $unwind: '$cities' }, ...countBy('$cities')],
            sources: countBy('$source'),
            jobTypes: countBy('$jobType'),
            companies: [{ $group: { _id: '$companyKey' } }, { $count: 'n' }],
            total: [{ $count: 'n' }],
          },
        },
      ])
      .toArray();
    res.json({
      roles: facets.roles,
      cities: facets.cities,
      sources: facets.sources,
      jobTypes: facets.jobTypes,
      companies: facets.companies[0]?.n ?? 0,
      total: facets.total[0]?.n ?? 0,
    });
  });

  router.get('/evaluation', async (_req, res) => {
    const evaluation = await db.collection('evaluations').findOne({}, { sort: { evaluatedAt: -1 }, projection: { _id: 0 } });
    if (!evaluation) return res.status(404).json({ error: 'No evaluation yet. Run `npm run eval:score`.' });
    const { sampleIds, ...report } = evaluation;
    let coverage = null;
    if (Array.isArray(sampleIds) && sampleIds.length === evaluation.sampleSize) {
      const currentPredictions = await jobs.countDocuments({
        _id: { $in: sampleIds },
        role: { $in: ROLES },
        city: { $type: 'string', $ne: '' },
        isFresher: { $type: 'bool' },
      });
      coverage = {
        sampleSize: evaluation.sampleSize,
        currentPredictions,
        missingPredictions: evaluation.sampleSize - currentPredictions,
        canRescore: currentPredictions === evaluation.sampleSize,
      };
    }
    res.json({ ...report, coverage });
  });

  return router;
}
