Feature: Main scene

  Scenario: I enter bot first time
    Given there is referrals:
      | code  | gaSource           |
      | i1    | instagram-igor    |
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
    Then Referral visit recorded with referral 'instagram-igor'
    Then User is persisted with referral 'instagram-igor' and uuid

  Scenario: I can click customize
    Given Scene is 'main_scene'
    When I click markup [~main_scene.customize]
    Then Bot responds '*Подобрать*'
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

  Scenario: I can view particular card on bot start
    Given now is 2020-01-02 12:00
    Given there is events:
      | extId  | title | category | timetable            |
      | K1     | A     | movies   | 1 января 2020: 21:59 |
    Given there is referrals:
      | code  | gaSource           |
      | i1    | instagram-igor    |
    When I start bot with payload 'i1_event-K1'
    Then Bot responds '*<b>A</b> <i>(прошло)</i>*' with inline buttons:
      """
      [👍] [👎] [⭐]
      [🚀 Открыть бот]
      """
    When I click inline [Открыть бот]
    Then Bot edits inline buttons:
      """
      [👍] [👎] [⭐]
      """
    Then Bot responds '*Приветствую, TestFirstName*'
    Then Google analytics pageviews will be:
      | dp               | dt                |
      | /start-event/k1  | Прямая ссылка > A |
      | /                | Главное меню      |
    Then Google analytics params will be:
      | key | value          |
      | cs  | instagram-igor |

  Scenario: I will be redirect to standart start scene if event not found
    When I start bot with payload 'i1_event-bad'
    Then Bot responds '*Приветствую, TestFirstName*'

  Scenario: Referral will be saved even if its not exists in table
    When I start bot with payload 'bb'
    Then Google analytics params will be:
      | key | value          |
      | cs  | bb             |

  Scenario: I can view particular card on bot by configured redirect
    Given now is 2020-01-02 12:00
    Given there is events:
      | extId  | title | category | timetable            |
      | K1     | A     | movies   | 1 января 2020: 21:59 |
    Given there is referrals:
      | code  | gaSource           | redirect |
      | i1    | instagram-igor     |  K1       |
    When I start bot with payload 'i1'
    Then Bot responds '*<b>A</b> <i>(прошло)</i>*' with inline buttons:
      """
      [👍] [👎] [⭐]
      [🚀 Открыть бот]
      """