import { Message, Update, UserFromGetMe } from 'typegram'
import { Chat } from 'typegram/manage'

export const MOCK_CHAT_ID = 1234
export const MOCK_CHAT: Chat.PrivateChat = {
    id: MOCK_CHAT_ID,
    type: 'private',
    first_name: ''
}
export const TEST_USER_TID = 7777
export type EditMessageReplyType =
    true
    | (Update.Edited & Message.LocationMessage)
    | (Update.Edited & Message.TextMessage)
    | (Update.Edited & Message.AnimationMessage)
    | (Update.Edited & Message.AudioMessage)
    | (Update.Edited & Message.DocumentMessage)
    | (Update.Edited & Message.PhotoMessage)
    | (Update.Edited & Message.VideoMessage)
    | (Update.Edited & Message.ChannelChatCreatedMessage)
    | (Update.Edited & Message.ConnectedWebsiteMessage)
    | (Update.Edited & Message.ContactMessage)
    | (Update.Edited & Message.DeleteChatPhotoMessage)
    | (Update.Edited & Message.DiceMessage)
    | (Update.Edited & Message.GameMessage)
    | (Update.Edited & Message.GroupChatCreatedMessage)
    | (Update.Edited & Message.InvoiceMessage)
    | (Update.Edited & Message.LeftChatMemberMessage)
    | (Update.Edited & Message.MigrateFromChatIdMessage)
    | (Update.Edited & Message.MigrateToChatIdMessage)
    | (Update.Edited & Message.NewChatMembersMessage)
    | (Update.Edited & Message.NewChatPhotoMessage)
    | (Update.Edited & Message.NewChatTitleMessage)
    | (Update.Edited & Message.PassportDataMessage)
    | (Update.Edited & Message.ProximityAlertTriggeredMessage)
    | (Update.Edited & Message.PinnedMessageMessage)
    | (Update.Edited & Message.PollMessage)
    | (Update.Edited & Message.StickerMessage)
    | (Update.Edited & Message.SuccessfulPaymentMessage)
    | (Update.Edited & Message.SupergroupChatCreated)
    | (Update.Edited & Message.VenueMessage)
    | (Update.Edited & Message.VideoNoteMessage)
    | (Update.Edited & Message.VoiceMessage)

export interface TelegramCtxMockOptions {
    botIsBlocked: boolean // will throw Exception on attempt to send
    startWithMsgId: number
}

export const MOCK_BOT_INFO: UserFromGetMe = {
    id: 0,
    first_name: 'bot',
    can_join_groups: false,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    username: 'bot',
    is_bot: true
}