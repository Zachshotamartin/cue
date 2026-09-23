import type { Asset, Draft, Take } from "../contracts";
export type FilmProps = {
  draft: Draft;
  assets: Asset[];
  takes: Take[];
  urls: Record<string, string>;
  fontUrl?: string;
};
