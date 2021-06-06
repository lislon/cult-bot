Feature: Packs scene

  Background:
    Given now is 2020-01-01 12:00

  Scenario: I can see 2 events in first pack
    Given there is events:
      | title | category    | timetable             |
      | A     | exhibitions | пн-вс: 15:00          |
      | B     | exhibitions | пн-вс: 15:00          |
      | C     | exhibitions | пн-вс: 15:00          |
      | D     | exhibitions | пн-вс: 15:00          |
      | D_old | exhibitions | 1 октября 2019: 15:00 |
    Given there is packs:
      | title    | desc       | events         | weight |
      | PACK1    | PACK1 desc | A, B, C, D_old | 0      |
      | PACK2    | PACK2 desc | A, C           | -10    |
      | PACK3    | PACK3 desc | A, D_old       | 0      |
    Given Scene is 'packs_scene'
    Then Bot responds '👇'
    Then Bot responds 'Узнайте больше о тематических коллекциях событий в подборках и следите за их пополнением' with inline buttons:
      """
      [PACK2]
      [PACK1]
      [Назад]
      """
    Then I click inline [PACK1]
    Then Bot edits text:
      """
      <b>PACK1</b>

      PACK1 desc

      В подборке 3 события
      """
    Then Bot edits inline buttons:
      """
      [~packs_scene.pack_card_open]
      [◀️ Назад]
      """
    Then I click inline [Посмотреть события]
    Then Bot edits text '*<b>A</b>*'
    Then Bot edits inline buttons:
      """
      [◀️] [👍] [👎] [⭐]
      [«] [# 1 / 3] [»]
      """
    Then I click inline [◀️]
    Then Google analytics pageviews will be:
      | dp                      | dt                         |
      | /packs/                 | Подборки                   |
      | /packs/pack1/           | Подборки > PACK1           |
      | /packs/pack1/p1/test-0  | Подборки > PACK1 > A [1/3] |
      | /packs/pack1/           | Подборки > PACK1           |


    Scenario: I see list of packs but click very late
      Given there is events:
        | title | category    | timetable               |
        | A     | exhibitions | 1 января 2020: 15:00    |
        | B     | exhibitions | 2 января 2020: 15:00    |
      Given there is packs:
        | title    | desc       | events         | weight |
        | PACK1    | PACK1 desc | A, B           | 0      |
      Given Scene is 'packs_scene'
      Then Bot responds '👇'
      Then Bot responds 'Узнайте больше о тематических коллекциях событий в подборках и следите за их пополнением' with inline buttons:
      """
      [PACK1]
      [Назад]
      """
      Then now is 2020-03-01 12:00
      Then I click inline [PACK1]
      Then Bot edits text '*Узнайте больше о тематических*'

   Scenario: I see pack event in far future
    Given there is events:
      | title | category    | timetable               |
      | A     | exhibitions | 1 марта 2020: 15:00     |
    Given there is packs:
      | title    | desc       | events         | weight | hideIfLessThen |
      | PACK1    | PACK1 desc | A              | 0      | 0              |
    Given Scene is 'packs_scene'
    Then Bot responds '👇'
    Then Bot responds 'Узнайте больше о тематических коллекциях событий в подборках и следите за их пополнением' with inline buttons:
      """
      [PACK1]
      [Назад]
      """