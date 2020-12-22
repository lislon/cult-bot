Feature: Feedback scene

  Background:
    Given I'am already used bot 100 times
    Given Scene is 'feedback_scene'

  Scenario: I can send text as feedback
    Then Bot responds '✉️ ' with markup buttons:
      """
      [Назад]
      """
    Then Bot responds 'Пройдите опрос, оставьте предложения и пожелания' with inline buttons:
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
    Then Bot responds 'Спасибо за ответ! Мы обязательно учтём это в дальнейшей работе 💪🏻'
    Then Bot sends reply to chat 'SUPPORT_FEEDBACK_CHAT_ID' with message '*Цена*'

  Scenario: I select positive items in survey with custom answer
    When I click inline [Пройти опрос]
    When I click inline [Да, подобрал]
    When I click inline [Цена]
    When I click inline [Свой вариант]
    Then Bot responds 'Напишите, что было важно при выборе событий:'
    When I type 'Всё гуд'
    Then Bot responds '*Спасибо*'
    Then Bot sends reply to chat 'SUPPORT_FEEDBACK_CHAT_ID' with message '*Всё гуд*'

  Scenario: I select negative items in survey
    When I click inline [Пройти опрос]
    When I click inline [Нет]
    When I click inline [Невнятное описание]
    When I click inline [Ничего не заинтересовало]
    When I click inline [Отправить]
    Then Bot responds 'Спасибо за отклик. Вернитесь к нам, мы обязательно станем лучше 💪🏻'
    Then Bot sends reply to chat 'SUPPORT_FEEDBACK_CHAT_ID' with message '*Ничего не заинтересовало*'

  Scenario: I select negative items in survey with custom answer
    When I click inline [Пройти опрос]
    When I click inline [Нет]
    When I click inline [Ничего не заинтересовало]
    When I click inline [Свой вариант]
    Then Bot responds 'Напишите, что не понравилось:'
    When I type 'Вы ужасны'
    Then Bot responds '*Спасибо*'
    Then Bot sends reply to chat 'SUPPORT_FEEDBACK_CHAT_ID' with message '*Вы ужасны*'

  Scenario: I go back to main scene
    When I click markup [Назад]
    Then I will be on scene 'main_scene'
