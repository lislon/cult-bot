Feature: Feedback scene

  Background:
    Given I'am already used bot 100 times
    Given Scene is 'feedback_scene'

  Scenario: I can send text as feedback
    Then Bot responds '✉️ ' with markup buttons:
      """
      [В Главное меню]
      """
    Then Bot responds 'Напишите здесь всё что вы хотите нам сказать. Также предлагаем пройти короткий опрос, чтобы мы смогли сделать бот более приятным для вас' with inline buttons:
      """
      [Написать авторам] [Пройти опрос]
      """
    When I click inline [Написать авторам]
    When I type 'Вы молодцы'
    Then Bot sends reply to chat 'SUPPORT_FEEDBACK_CHAT_ID' with message '*Вы молодцы*'
    Then Bot responds '*Спасибо*'

  Scenario: I go back to main scene
    When I click markup [В Главное меню]
    Then I will be on scene 'main_scene'