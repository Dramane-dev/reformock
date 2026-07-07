export const state = {
  API: "/v1",
  TOKEN: null,
  AUTH_DISABLED: false,
  STATUSES: [],
  ALL: [],
  TOTAL: 0,
  PAGE: 0,
};

export const PAGE_SIZE = 10;

export const authHeaders = () =>
  state.AUTH_DISABLED || !state.TOKEN ? {} : { Authorization: "Bearer " + state.TOKEN };
