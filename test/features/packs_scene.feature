Feature: Packs scene

  Background:
    Given now is 2020-01-01 12:00
    Given there is events:
      | title | category    | timetable             |
      | A     | exhibitions | пн-вс: 15:00          |
      | B     | exhibitions | пн-вс: 15:00          |
      | C     | exhibitions | пн-вс: 15:00          |
      | D_old | exhibitions | 1 октября 2019: 15:00 |
    Given there is packs:
      | title | desc    | events      | weight |
      | P1    | P1 desc | A, B, D_old |  0     |
      | P2    | P2 desc | C           |  -10   |
      | P3    | P3 desc | D_old       |  0     |
    Given Scene is 'packs_scene'

  Scenario: I can see 2 events in first pack
    Then Bot responds '👇'
    Then Bot responds 'Узнайте больше о тематических коллекциях событий в подборках и следите за их пополнением' with inline buttons:
      """
      [P2]
      [P1]
      [Назад]
      """
    Then I click inline [P1]
    Then Bot edits text:
      """
      <b>P1</b>

      P1 desc

      В подборке 2 события
      """
    Then Bot edits inline buttons:
      """
      [~packs_scene.pack_card_open]
      [Назад]
      """
    Then I click inline [Посмотреть события]
    Then Bot edits text '*<b>A</b>*'
    Then Bot edits inline buttons:
      """
      [«] [👍 0] [👎 0] [⭐] [1 / 2 »]
      [◀️ Назад]
      """
    Then I click inline [Назад]
    Then Google analytics pageviews will be:
      | dp                | dt                 |
      | /packs/           | Подборки           |
      | /packs/p1/        | Подборки > P1      |
      | /packs/p1/test-0  | Подборки > P1 > A  |
      | /packs/p1/        | Подборки > P1      |