Feature: Main scene

  Scenario: I enter bot first time
    When I start bot with payload 'i1'
    Then Bot responds '*Приветствую, TestFirstName*'
    Then Bot responds '*Начнем?*' with markup buttons:
      """
      [~main_scene.customize]
      [~main_scene.tops] [~main_scene.packs]
      [~main_scene.search]
      [~main_scene.feedback] [~main_scene.favorites]
      """

    Then Google analytics pageviews will be:
      | dp                | dt                |
      | /                 | Главное меню      |

    Then Google analytics params will be:
      | key | value          |
      | cs  | instagram-igor |

  Scenario: I can click customize
    Given Scene is 'main_scene'
    When I click markup [~main_scene.customize]
    Then Bot responds '👇'
    Then Bot responds '*фильтр*'

  Scenario: I can click packs
    Given Scene is 'main_scene'
    When I click markup [~main_scene.packs]

  Scenario: I can click rubrics
    Given Scene is 'main_scene'
    When I click markup [~main_scene.tops]
    Then Bot responds '*рубрик*'

  Scenario: I can click search
    Given Scene is 'main_scene'
    When I click markup [~main_scene.search]
    Then Bot responds '*Введите*'

  Scenario: I use /menu command
    Given Scene is 'search_scene'
    When I type '/menu'
    Then Bot responds '*меню*'

  Scenario: I can type bred, I should receive /menu command
    Given Scene is 'main_scene'
    When I type 'Бред'
    Then Bot responds '*/menu*'
