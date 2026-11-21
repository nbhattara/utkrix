const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const getPageOptions = ({ page = '1', limit = String(DEFAULT_PAGE_SIZE) }) => {
  const pageNumber = Number(page);
  const requestedLimit = Number(limit);

  return {
    page: pageNumber,
    limit: Math.min(requestedLimit, MAX_PAGE_SIZE),
    skip: (pageNumber - 1) * Math.min(requestedLimit, MAX_PAGE_SIZE),
  };
};

const setPaginationHeaders = (res, { page, limit }, total) => {
  res.set({
    'X-Total-Count': String(total),
    'X-Page': String(page),
    'X-Page-Size': String(limit),
    'X-Total-Pages': String(Math.ceil(total / limit)),
  });
};

module.exports = { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, getPageOptions, setPaginationHeaders };
