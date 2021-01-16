Feature: Feedback scene

  Background:
    Given I'am already used bot 100 times
    Given Scene is 'feedback_scene'

  Scenario: I can send text as feedback
    Then Bot responds '✉️ ' with no markup buttons
    Then Bot responds '*опрос*' with inline buttons:
      """
      [Пройти опрос]
      [Написать авторам]
      [Назад]
      """
    When I click inline [Написать авторам]
    When I type 'Вы молодцы'
    Then Bot sends reply to chat 'SUPPORT_FEEDBACK_CHAT_ID' with message '*Вы молодцы*'
    Then Bot responds '*Спасибо*' with inline buttons:
      """
      [Назад]
      """

  Scenario: I select positive items in survey
    When I click inline [Пройти опрос]
    When I click inline [Да, подобрал]
    When I click inline [Цена]
    When I click inline [Отправить]
    Then Bot responds 'Спасибо за ответ! Мы обязательно учтём это в дальнейшей работе 💪🏻' with inline buttons:
      """
      [Назад]
      """
    Then Bot sends reply to chat 'SUPPORT_FEEDBACK_CHAT_ID' with message '*Цена*'

  Scenario: I select positive items in survey with custom answer
    When I click inline [Пройти опрос]
    When I click inline [Да, подобрал]
    When I click inline [Цена]
    When I click inline [Свой вариант]
    Then Bot responds 'Напишите, что было важно при выборе событий:' with markup buttons:
      """
      [Назад]
      """
    When I type 'Всё гуд'
    Then Bot responds '*Спасибо*'
    Then Bot sends reply to chat 'SUPPORT_FEEDBACK_CHAT_ID' with message '*Всё гуд*'
    When I click markup [Назад]
    Then I will be on scene 'main_scene'

  Scenario: I select negative items in survey
    When I click inline [Пройти опрос]
    When I click inline [Нет]
    When I click inline [Невнятное описание]
    When I click inline [Ничего не заинтересовало]
    When I click inline [Отправить]
    Then Bot responds 'Спасибо за ответ! Мы обязательно учтём это в дальнейшей работе 💪🏻' with inline buttons:
      """
      [Назад]
      """
    Then Bot sends reply to chat 'SUPPORT_FEEDBACK_CHAT_ID' with message '*Ничего не заинтересовало*'
    When I click inline [Назад]
    Then I will be on scene 'main_scene'

  Scenario: I select negative items in survey with custom answer
    When I click inline [Пройти опрос]
    When I click inline [Нет]
    When I click inline [Ничего не заинтересовало]
    When I click inline [Свой вариант]
    Then Bot responds 'Напишите, что не понравилось:'
    When I type 'Вы ужасны'
    Then Bot responds '*Спасибо*' with inline buttons:
      """
      [Назад]
      """
    Then Bot sends reply to chat 'SUPPORT_FEEDBACK_CHAT_ID' with message '*Вы ужасны*'
    When I click inline [Назад]
    Then I will be on scene 'main_scene'
    Then Google analytics pageviews will be:
      | dp                                      | dt                                                      |
      | /feedback/                              | Обратная связь                                          |
      | /feedback/take_survey/                  | Обратная связь > Опрос                                  |
      | /feedback/take_survey/dislike/          | Обратная связь > Опрос > Не нашел событий                 |
      | /feedback/take_survey/dislike/custom/   | Обратная связь > Опрос > Не нашел событий > Свой вариант  |
      | /                                       | Главное меню                                             |

  Scenario: I go back to main scene
    When I click inline [Назад]
    Then I will be on scene 'main_scene'
