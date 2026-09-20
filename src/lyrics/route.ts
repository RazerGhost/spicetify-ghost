// Spotify's own lyrics route (xpui-modules.js), which Ghost's lyrics page takes over.

import { history } from "../platform";

export const LYRICS_ROUTE = "/lyrics";

export const onLyricsRoute = () => history().location.pathname === LYRICS_ROUTE;
