Feature: Feedback scene

  Background:
    Given I'am already used bot 100 times
    Given Scene is 'feedback_scene'

  Scenario: I can send text as feedback
    Then Bot responds '✉️ Поскольку вы уже некоторое время пользуетесь ботом, хотелось бы спросить как он вам?' with markup buttons:
      """
      [Опросец]
      [Написать авторам]
      [В Главное меню]
      """
    When I type 'Вы молодцы'
    Then Bot sends reply to chat 'SUPPORT_FEEDBACK_CHAT_ID' with message '*Вы молодцы*'
    Then Bot responds '*Спасибо*'

  Scenario: I go back to main scene
    When I click markup [В Главное меню]
    Then I will be on scene 'main_scene'