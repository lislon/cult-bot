Feature: Customize navigation
  Test paging and entering/exiting menus

  январь 2020
  пн	вт	ср	чт	пт	сб	вс
  1	2	3	4	5
  6	7	8	9	10	11	12
  13	14	15	16	17	18	19
  20	21	22	23	24	25	26
  27	28	29	30	31

  Background:
    Given now is 2020-01-01 12:00
    Given Scene is 'customize_scene'

  Scenario: I can go back from events by inline button
    Given there is events:
      | title   | category     | timetable        |
      | A       | exhibitions  | вс: 21:59        |
    When I click markup [Показать события]
    Then Bot responds '*<b>A</b>*' with inline buttons:
      """
      [Назад [к фильтрам]]
      """
    When I click inline [Назад [к фильтрам]]
    Then Bot responds '*настройте*' with markup buttons:
      """
      [Рубрики] [Приоритеты]
      [Время] [Формат]
      [Показать события]
      [Назад]
      """

  Scenario: I can page through events
    Given there is events:
      | title   | category     | timetable |
      | A       | exhibitions  | вс: 21:50 |
      | B       | exhibitions  | вс: 21:51 |
      | C       | exhibitions  | вс: 21:52 |
      | D       | exhibitions  | вс: 21:53 |
    When I click markup [Показать события]
    Then Bot responds '*<b>A</b>*'
    Then Bot responds '*<b>B</b>*'
    Then Bot responds '*<b>C</b>*' with inline buttons:
      """
      [Показать еще (1)]
      """
    When I click inline [Показать еще (1)]
    Then Bot responds '*<b>D</b>*' with inline buttons:
      """
      [Назад [к фильтрам]]
      """