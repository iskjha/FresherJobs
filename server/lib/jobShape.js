// Shape of a job as returned by the API (internal fields like description,
// searchText and the LLM tag cache never leave the server).
export const PUBLIC_PROJECTION = {
  title: 1,
  company: 1,
  location: 1,
  url: 1,
  source: 1,
  postedAt: 1,
  department: 1,
  salary: 1,
  snippet: 1,
  role: 1,
  city: 1,
  otherCities: 1,
  jobType: 1,
  minExperienceYears: 1,
  companyKey: 1,
};

export function toPublicJob(doc) {
  return {
    id: doc._id,
    title: doc.title,
    company: doc.company,
    location: doc.location,
    url: doc.url,
    source: doc.source,
    postedAt: doc.postedAt instanceof Date ? doc.postedAt.toISOString() : doc.postedAt,
    department: doc.department || '',
    salary: doc.salary || '',
    snippet: doc.snippet || '',
    role: doc.role,
    city: doc.city,
    otherCities: doc.otherCities || [],
    jobType: doc.jobType,
    minExperienceYears: doc.minExperienceYears ?? 0,
  };
}
