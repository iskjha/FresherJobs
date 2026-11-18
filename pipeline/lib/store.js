// MongoDB persistence for the pipeline: the LLM tag cache lives on each job
// document (`tag`), so unchanged postings are never re-tagged.

const searchTextOf = (p) =>
  [p.title, p.company, p.tags.role, p.tags.city, ...p.tags.otherCities, p.department, p.description?.slice(0, 600)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const toDate = (v) => {
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t) : null;
};

export async function loadTagCache(db) {
  const cache = {};
  const cursor = db.collection('jobs').find({ tag: { $exists: true } }, { projection: { tag: 1 } });
  for await (const doc of cursor) cache[doc._id] = { hash: doc.tag.hash, raw: doc.tag.raw, taggedAt: doc.tag.taggedAt };
  return cache;
}

/**
 * Upserts every tagged candidate (fresher or not, so rejections stay cached)
 * and closes vanished jobs only on boards collected successfully.
 */
export async function saveJobs(db, posts, cache, now = new Date(), sourceStats = []) {
  const jobs = db.collection('jobs');
  const ops = posts.map((p) => {
    const t = p.tags;
    const c = cache[p.sourceId];
    const postedAt = toDate(p.postedAt);
    return {
      updateOne: {
        filter: { _id: p.sourceId },
        update: {
          $set: {
            title: p.title,
            company: p.company,
            companyKey: p.company.toLowerCase(),
            location: p.location,
            url: p.url,
            source: p.source,
            board: p.board,
            ...(postedAt ? { postedAt } : {}),
            department: p.department || '',
            salary: p.salary || '',
            snippet: (p.description || '').replace(/\s+/g, ' ').slice(0, 280),
            description: (p.description || '').slice(0, 4000),
            role: t.role,
            city: t.city,
            otherCities: t.otherCities,
            cities: [t.city, ...t.otherCities],
            jobType: t.jobType,
            minExperienceYears: t.minExperienceYears,
            isFresher: t.isFresher,
            tagger: t.tagger,
            searchText: searchTextOf(p),
            active: true,
            lastSeenAt: now,
            ...(c ? { tag: { hash: c.hash, raw: c.raw, taggedAt: c.taggedAt } } : {}),
          },
          $unset: { closedAt: '' },
          // Postings without a publish date sort by when we first saw them.
          $setOnInsert: { firstSeenAt: now, ...(postedAt ? {} : { postedAt: now }) },
        },
        upsert: true,
      },
    };
  });
  const write = ops.length ? await jobs.bulkWrite(ops, { ordered: false }) : { upsertedCount: 0, modifiedCount: 0 };
  const successfulBoards = sourceStats.filter((s) => s.ok).map(({ source, board }) => ({ source, board }));
  const closed = successfulBoards.length
    ? await jobs.updateMany(
        { active: true, lastSeenAt: { $lt: now }, $or: successfulBoards },
        { $set: { active: false, closedAt: now } }
      )
    : { modifiedCount: 0 };
  return { inserted: write.upsertedCount, updated: write.modifiedCount, closed: closed.modifiedCount };
}

export async function saveRun(db, run) {
  await db.collection('runs').insertOne({ ...run });
}
