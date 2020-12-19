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
    Then Bot responds 'Тут подборки на неделю' with inline buttons:
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

      События:
       - A
       - B
      """
    Then Bot edits inline buttons:
      """
      [Посмотреть события]
      [Следующая подборка » (2 / 2)]
      [Назад [Список подборок]]
      """
    Then I click inline [Посмотреть события]
    Then Bot edits text '*<b>A</b>*'
    Then Bot edits inline buttons:
      """
      [«] [1 / 2] [»]
      [Назад [P1]]
      """
    Then I click inline [Назад [P1]]
    Then Google analytics pageviews will be:
      | dp                | dt                 |
      | /packs/           | Подборки           |
      | /packs/p1/        | Подборки > P1      |
      | /packs/p1/test-0  | Подборки > P1 > A  |
      | /packs/p1/        | Подборки > P1      |