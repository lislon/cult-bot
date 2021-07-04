Feature: Feedback scene

  Background:
    Given I'am already used bot 100 times
    Given Scene is 'feedback_scene'

  Scenario: I can send text as feedback
    Then Bot responds '*Напишите*' with markup buttons:
      """
      [⏮ В главное меню]
      """
    When I type 'Вы молодцы'
    Then Bot sends reply to chat 'SUPPORT_FEEDBACK_CHAT_ID' with message '*Вы молодцы*'
    Then Bot responds '*сообщение отправлено*'

  Scenario: I can go back while sending message
    Then Bot responds something
    When I click markup [⏮ В главное меню]
    Then I will be on scene 'main_scene'

  Scenario: I go back to main scene
    When I click markup [В главное меню]
    Then I will be on scene 'main_scene'
