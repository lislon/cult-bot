Feature: Packs scene

  Background:
    Given now is 2020-01-01 12:00
    Given Scene is 'packs_scene'
    Given there is events:
      | title | category    | tag_level_1          | timetable    |
      | A     | exhibitions | #временныевыставки   | пн-вс: 15:00 |
      | B     | exhibitions | #постоянныеколлекции | пн-вс: 15:00 |

  Scenario: I can 6 categories when i enter customize
    Then Bot responds 'Пожалуйста, выберите категорию' with markup buttons:
      """
      [🎭 Театры] [🎨 Выставки]
      [🎥 Кино] [🌐 Мероприятия]
      [🌤 Прогулки] [🎷 Концерты]
      [◀️ Назад]
      """

  Scenario: I can see events in category 'temporary exhibitions'
    When I click markup [Выставки]
    Then Bot responds 'Пожалуйста, выберите категорию' with markup buttons:
      """
      [Постоянные коллекции] [Временные выставки]
      [Назад]
      """
    Then I click markup [Временные выставки]
    Then Bot responds '<b>❔ Временные выставки</b> на предстоящие выходные 04-05 января:'
    Then Bot responds with event 'A'

  Scenario: I can see events in category 'permanent exhibitions'
    When I click markup [Выставки]
    Then Bot responds 'Пожалуйста, выберите категорию' with markup buttons:
      """
      [Постоянные коллекции] [Временные выставки]
      [Назад]
      """
    Then I click markup [Постоянные коллекции]
    Then Bot responds '<b>❔ Постоянные коллекции</b> на предстоящие выходные 04-05 января:'
    Then Bot responds with event 'B'

  Scenario: When I click back in subcategory I get into packs menu
    When I click markup [Выставки]
    Then I click markup [Назад]
    Then Bot responds 'Пожалуйста, выберите категорию'

  Scenario: When I click back in packs menu i will get to main scene
    Then I click markup [Назад]
    Then I will be on scene 'main_scene'