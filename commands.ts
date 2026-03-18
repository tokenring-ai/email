import draftClear from "./commands/email/draft/clear.ts";
import draftGet from "./commands/email/draft/get.ts";
import draftSend from "./commands/email/draft/send.ts";
import inboxList from "./commands/email/inbox/list.ts";
import messageClear from "./commands/email/message/clear.ts";
import messageGet from "./commands/email/message/get.ts";
import messageInfo from "./commands/email/message/info.ts";
import messageSelect from "./commands/email/message/select.ts";
import messageSet from "./commands/email/message/set.ts";
import providerGet from "./commands/email/provider/get.ts";
import providerReset from "./commands/email/provider/reset.ts";
import providerSelect from "./commands/email/provider/select.ts";
import providerSet from "./commands/email/provider/set.ts";
import search from "./commands/email/search.ts";

export default [
  providerGet,
  providerSet,
  providerSelect,
  providerReset,
  inboxList,
  search,
  messageGet,
  messageSelect,
  messageSet,
  messageInfo,
  messageClear,
  draftGet,
  draftClear,
  draftSend,
];
