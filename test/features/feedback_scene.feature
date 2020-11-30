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

  Scenario: I select positive items in survey
    When I click inline [Пройти опрос]
    When I click inline [Да, подобрал]
    When I click inline [Цена]
    When I click inline [Отправить]
    Then Bot responds '*рады услышать*'
    Then Bot sends reply to chat 'SUPPORT_FEEDBACK_CHAT_ID' with message '*Цена*'

  Scenario: I select positive items in survey with custom answer
    When I click inline [Пройти опрос]
    When I click inline [Да, подобрал]
    When I click inline [Цена]
    When I click inline [Свой вариант]
    Then Bot responds 'Напишите, пожалуйста, что вам важно при выборе событий:'
    When I type 'Всё гуд'
    Then Bot responds '*Спасибо*'
    Then Bot sends reply to chat 'SUPPORT_FEEDBACK_CHAT_ID' with message '*Всё гуд*'

  Scenario: I select negative items in survey
    When I click inline [Пройти опрос]
    When I click inline [Нет]
    When I click inline [Невнятное описание]
    When I click inline [Ничего не понравилось]
    When I click inline [Отправить]
    Then Bot responds 'Спасибо за Ваш отклик. Вернитесь к нам через пару недель, мы обязательно станем лучше'
    Then Bot sends reply to chat 'SUPPORT_FEEDBACK_CHAT_ID' with message '*Ничего не понравилось*'

  Scenario: I select negative items in survey with custom answer
    When I click inline [Пройти опрос]
    When I click inline [Нет]
    When I click inline [Ничего не понравилось]
    When I click inline [Свой вариант]
    Then Bot responds 'Напишите, пожалуйста, что вам не понравилось:'
    When I type 'Вы ужасны'
    Then Bot responds '*Спасибо*'
    Then Bot sends reply to chat 'SUPPORT_FEEDBACK_CHAT_ID' with message '*Вы ужасны*'

  Scenario: I go back to main scene
    When I click markup [В Главное меню]
    Then I will be on scene 'main_scene'
