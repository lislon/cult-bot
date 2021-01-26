Feature: Tops scene

  Background:
    Given now is 2020-01-01 12:00
    Given Scene is 'tops_scene'
    Given there is events:
      | title | category    | tag_level_1          | timetable    |
      | A     | exhibitions | #временныевыставки   | пн-вс: 15:00 |
      | B     | exhibitions | #постоянныеколлекции | пн-вс: 15:00 |

  Scenario: I can see 6 categories when i enter customize
    Then Bot responds '*Выберите*' with markup buttons:
      """
      [~tops_scene.theaters] [~tops_scene.exhibitions]
      [~tops_scene.movies] [~tops_scene.events]
      [~tops_scene.walks] [~tops_scene.concerts]
      [◀️ В главное меню]
      """

  Scenario: I can see events in category 'temporary exhibitions'
    When I click markup [~tops_scene.exhibitions]
    Then Bot responds 'Выберите между двумя вариантами' with markup buttons:
      """
      [~tops_scene.exhibitions_perm]
      [~tops_scene.exhibitions_temp]
      [~tops_scene.back_exhibitions]
      """
    Then I click markup [~tops_scene.exhibitions_temp]
    Then Bot responds '<b>Временные выставки</b> на выходные 04-05 января:'
    Then Bot responds with event 'A'
    Then Google analytics pageviews will be:
      | dp                                 | dt                                       |
      | /top/                              | Рубрики                                  |
      | /top/exhibitions/                  | Рубрики > Выставки                       |
      | /top/exhibitions/temp/p1/TEST-0-a/ | Рубрики > Выставки > Временные > A [1/1] |


  Scenario: I can see events in category 'permanent exhibitions'
    When I click markup [~tops_scene.exhibitions]
    Then Bot responds '*Выберите*' with markup buttons:
      """
      [~tops_scene.exhibitions_perm]
      [~tops_scene.exhibitions_temp]
      [~tops_scene.back_exhibitions]
      """
    Then I click markup [~tops_scene.exhibitions_perm]
    Then Bot responds '<b>Постоянные коллекции</b> на выходные 04-05 января:'
    Then Bot responds with event 'B'

  Scenario: When I click back in subcategory I get into tops menu
    When I click markup [~tops_scene.exhibitions]
    Then I click markup [~tops_scene.back_exhibitions]
    Then Bot responds '*Выберите рубрику*'
    Then I will be on scene 'tops_scene'

  Scenario: When I click back in tops menu i will get to main scene
    Then I click markup [В главное меню]
    Then I will be on scene 'main_scene'

  Scenario: I see today message on last day of weekend
    Given now is 2020-01-05 12:00
    When I click markup [~tops_scene.exhibitions]
    Then I click markup [~tops_scene.exhibitions_perm]
    Then Bot responds '*сегодня*'

